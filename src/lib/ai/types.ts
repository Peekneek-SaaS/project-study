/**
 * The vocabulary both sides of the app share about AI providers.
 *
 * Split out from `providers.ts`, which is `server-only` because it holds API
 * keys and model instances. The composer's picker needs the *names* and nothing
 * else, and a client component importing them from there would pull the whole
 * server module into the browser bundle — or, more likely, fail the build.
 */

/**
 * The chain, in its default order.
 *
 * Order matters: this is the sequence a request falls through when a provider
 * is down, and the first entry is what a user who has never touched the picker
 * gets. See `providerChain` for how a user's pick rotates it.
 */
export const AI_PROVIDERS = ["openai", "anthropic", "google"] as const;

export type AiProvider = (typeof AI_PROVIDERS)[number];

export const DEFAULT_AI_PROVIDER: AiProvider = "openai";

/**
 * Whether a value names a provider.
 *
 * Needed on both sides: the server checks it against the request body, and the
 * client checks it against `localStorage`, where a value written by an older
 * version of this app may still be sitting.
 */
export function isAiProvider(value: unknown): value is AiProvider {
  return (
    typeof value === "string" &&
    (AI_PROVIDERS as readonly string[]).includes(value)
  );
}

/**
 * What each provider is called, and what it is good at.
 *
 * Written for someone choosing between them mid-sentence rather than for a
 * datasheet — the picker sits next to the send button, and nobody stops writing
 * a question to read a comparison table.
 */
export const PROVIDER_INFO: Record<
  AiProvider,
  { label: string; description: string }
> = {
  openai: { label: "OpenAI", description: "Balanced and fast" },
  anthropic: { label: "Claude", description: "Careful, long answers" },
  google: { label: "Gemini", description: "Best on very long documents" },
};
