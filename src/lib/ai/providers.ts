/**
 * No `server-only` marker here, deliberately.
 *
 * This module is imported by the Trigger.dev worker as well as by Next. That
 * package resolves to a file that throws on import unless React's
 * `react-server` condition is set, which a plain Node bundle does not set — so
 * the marker would not restrict this module, it would break every task that
 * reaches it.
 *
 * Nothing is lost by dropping it: everything here touches Prisma or an API key,
 * and neither survives a client bundle quietly.
 */

import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import type { LanguageModelV4, LanguageModelV4Middleware } from "@ai-sdk/provider";
import { wrapLanguageModel, type LanguageModel } from "ai";

import {
  AI_PROVIDERS,
  DEFAULT_AI_PROVIDER,
  isAiProvider,
  type AiProvider,
} from "@/lib/ai/types";

/**
 * The three models this app can think with, and the order it falls through
 * them.
 *
 * One provider is one outage away from a chat that cannot answer and a drive
 * full of documents nothing has read. So every call — the reading of a document
 * and every turn of every conversation — goes through a chain rather than a
 * single model: OpenAI first, Anthropic behind it, Gemini behind that, with the
 * user's pick moved to the front when they have made one.
 *
 * The fallback is built as a *model wrapper* rather than a retry loop around
 * each call site. That is what makes it work for streaming as well as
 * generation: `streamText` does not reject when a provider is down, it just
 * produces a stream that errors, so a `try`/`catch` around it would never fire.
 * Wrapped at this level, the swap happens inside `doStream` — before a single
 * token has been handed to the client — and every caller gets it for free by
 * doing nothing at all.
 */

/**
 * The key that has to be present for a provider to be worth trying.
 *
 * These are the names the SDK's own provider packages read, so setting one is
 * the only step to enabling a provider — there is no second place to register
 * it.
 */
const API_KEY_ENV: Record<AiProvider, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
};

/**
 * What a model is being asked to do.
 *
 * Chat and extraction want different things from the same provider. A
 * conversation is read by a person a sentence at a time, so it goes to the
 * strong model; reading a document is a few hundred pages of bulk work nobody
 * watches, so it goes to the cheap fast one. Splitting them here means the
 * choice is made once rather than at every call site.
 */
export type ModelKind = "chat" | "extraction";

/**
 * The default model ids, per provider and kind.
 *
 * Overridable by environment variable — see `modelId` — because model names
 * move faster than deploys do, and a renamed model should be a config change
 * rather than a patch.
 */
const DEFAULT_MODELS: Record<AiProvider, Record<ModelKind, string>> = {
  openai: { chat: "gpt-5", extraction: "gpt-5-mini" },
  anthropic: { chat: "claude-sonnet-5", extraction: "claude-haiku-4-5" },
  google: { chat: "gemini-2.5-pro", extraction: "gemini-2.5-flash" },
};

/** e.g. `AI_OPENAI_CHAT_MODEL`. */
function modelId(provider: AiProvider, kind: ModelKind): string {
  const override =
    process.env[`AI_${provider.toUpperCase()}_${kind.toUpperCase()}_MODEL`];
  return override?.trim() || DEFAULT_MODELS[provider][kind];
}

function languageModel(provider: AiProvider, kind: ModelKind): LanguageModelV4 {
  const id = modelId(provider, kind);
  switch (provider) {
    case "openai":
      return openai(id);
    case "anthropic":
      return anthropic(id);
    case "google":
      return google(id);
  }
}

/**
 * The providers this deployment can actually reach.
 *
 * A provider with no key is not a provider that will fail — it is one that will
 * throw on the first call and burn a link in the chain doing it. Filtering here
 * means a project with only a Gemini key gets a working chat with a
 * single-entry chain, rather than two guaranteed failures in front of it.
 */
export function availableProviders(): AiProvider[] {
  return AI_PROVIDERS.filter((provider) => {
    const key = process.env[API_KEY_ENV[provider]];
    return typeof key === "string" && key.trim().length > 0;
  });
}

/**
 * The order to try providers in, with the user's pick first.
 *
 * A rotation rather than a filter: picking Gemini means "start with Gemini",
 * not "only Gemini". Someone who chose a provider still wants an answer when
 * that provider is down, and silently getting one from the next model is a far
 * better outcome than an error message about a choice they made in passing.
 * Which one actually answered is recorded on the message either way.
 */
export function providerChain(preferred?: AiProvider | null): AiProvider[] {
  const available = availableProviders();
  if (available.length === 0) return [];

  if (!preferred || !available.includes(preferred)) return available;
  return [preferred, ...available.filter((p) => p !== preferred)];
}

/** Thrown when nothing is configured — a deployment problem, not a user one. */
export class NoProviderConfiguredError extends Error {
  constructor() {
    super(
      "No AI provider is configured. Set at least one of OPENAI_API_KEY, " +
        "ANTHROPIC_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY.",
    );
    this.name = "NoProviderConfiguredError";
  }
}

/** Which model answered, once one has. */
export interface ResolvedProvider {
  provider: AiProvider;
  model: string;
}

export interface FallbackModel {
  /** Hand this to `generateText` or `streamText`. */
  model: LanguageModel;
  /** The chain it will walk, first to last. */
  chain: AiProvider[];
  /**
   * Which provider actually produced the answer — readable only *after* the
   * call, because until then nobody knows.
   *
   * For a stream this is set the moment the connection is accepted, which is
   * before any token reaches the client, so a route can record it alongside the
   * message it is about to save.
   */
  resolved: () => ResolvedProvider | null;
}

/**
 * Whether a failure is worth trying the next provider for.
 *
 * Almost everything is. The exception is an aborted request: the user closed
 * the tab or pressed stop, and walking the rest of the chain would mean two
 * more providers being billed for an answer nobody is waiting for.
 */
function isWorthFallingBackFrom(error: unknown): boolean {
  if (error instanceof Error && error.name === "AbortError") return false;
  return true;
}

/**
 * Builds a model that tries each provider in turn.
 *
 * The middleware is handed the *first* provider's `doGenerate`/`doStream` by
 * `wrapLanguageModel`; the rest of the chain it calls directly, with the same
 * `params`. That works because `LanguageModelV4CallOptions` is provider-neutral
 * by design — the prompt, tools and settings have already been normalised by
 * the time they reach this layer, which is exactly why the swap can happen this
 * far down.
 */
export function createFallbackModel(
  kind: ModelKind,
  preferred?: AiProvider | null,
): FallbackModel {
  const chain = providerChain(preferred);
  if (chain.length === 0) throw new NoProviderConfiguredError();

  const models = chain.map((provider) => ({
    provider,
    id: modelId(provider, kind),
    model: languageModel(provider, kind),
  }));

  let resolved: ResolvedProvider | null = null;

  /**
   * Runs the chain until something answers.
   *
   * `first` is the wrapped model's own call, kept separate because
   * `wrapLanguageModel` supplies it as a closure rather than as a model to
   * invoke. Everything after it is called directly.
   */
  async function attempt<T>(
    first: () => PromiseLike<T>,
    call: (model: LanguageModelV4) => PromiseLike<T>,
  ): Promise<T> {
    let lastError: unknown;

    for (const [index, entry] of models.entries()) {
      try {
        const result = await (index === 0 ? first() : call(entry.model));
        resolved = { provider: entry.provider, model: entry.id };
        return result;
      } catch (error) {
        lastError = error;

        if (!isWorthFallingBackFrom(error)) throw error;

        // Logged rather than swallowed: a chain that quietly limps along on its
        // last provider looks exactly like a healthy one from the outside, and
        // this line is the only sign that the bill has moved.
        console.error(
          `[ai] ${entry.provider} (${entry.id}) failed${
            index < models.length - 1 ? "; falling back" : ""
          }`,
          error,
        );
      }
    }

    throw lastError;
  }

  const middleware: LanguageModelV4Middleware = {
    specificationVersion: "v4",
    wrapGenerate: ({ doGenerate, params }) =>
      attempt(doGenerate, (model) => model.doGenerate(params)),
    wrapStream: ({ doStream, params }) =>
      attempt(doStream, (model) => model.doStream(params)),
  };

  return {
    model: wrapLanguageModel({ model: models[0].model, middleware }),
    chain,
    resolved: () => resolved,
  };
}

/**
 * Narrows whatever arrived over the wire to a provider name.
 *
 * The picker's value is sent in the request body, so it is user input and gets
 * treated as such — an unknown name falls back to the default rather than being
 * passed through to a provider lookup that would throw.
 */
export function coerceProvider(value: unknown): AiProvider {
  return isAiProvider(value) ? value : DEFAULT_AI_PROVIDER;
}
