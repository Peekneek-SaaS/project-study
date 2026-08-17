import type { UIMessage } from "ai";

/**
 * Turning stored turns back into something `useChat` can carry on from.
 *
 * `ChatMessage.parts` is an AI SDK parts array stored verbatim, so this is
 * mostly a cast — but it is a cast across a trust boundary, and the boundary is
 * time rather than the network: rows written by an earlier version of this app,
 * or by an earlier version of the SDK, are read by today's renderer. A part
 * whose shape has changed underneath us should cost that one part, not the
 * whole conversation.
 */

/**
 * What the router hands back for a stored message.
 *
 * `createdAt` is typed as either, because it is both: a `Date` on the server and
 * an ISO string by the time it reaches the browser. This app's tRPC client runs
 * without a data transformer — see the commented-out superjson in
 * `trpc/client.tsx` — so every date crosses the wire as a string, and the rest
 * of the app wraps them in `new Date(...)` at the point of use. Nothing here
 * reads it; it is in the type so a caller that does knows what it is holding.
 */
export interface StoredMessage {
  id: string;
  role: string;
  parts: unknown;
  provider?: string | null;
  createdAt: string | Date;
}

/**
 * The roles the renderer knows how to draw.
 *
 * `system` is not among them on purpose — the system prompt is built per
 * request and never stored, so a stored system message would be something that
 * should not exist rather than something to render.
 */
function isRenderableRole(role: string): role is "user" | "assistant" {
  return role === "user" || role === "assistant";
}

/** Whether a stored part is at least shaped like one. */
function isPart(value: unknown): value is UIMessage["parts"][number] {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { type?: unknown }).type === "string"
  );
}

/**
 * Rehydrates a transcript.
 *
 * Messages that end up with no parts at all are dropped rather than rendered
 * empty: a blank bubble is a worse account of what happened than the message
 * simply not being there.
 */
export function toUIMessages(stored: StoredMessage[]): UIMessage[] {
  return stored.flatMap((message) => {
    if (!isRenderableRole(message.role)) return [];

    const parts = Array.isArray(message.parts)
      ? message.parts.filter(isPart)
      : [];

    if (parts.length === 0) return [];

    return [{ id: message.id, role: message.role, parts } satisfies UIMessage];
  });
}

/** The plain text of a message, for titles, previews and copy buttons. */
export function messageText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => (part as { text: string }).text)
    .join("\n\n")
    .trim();
}

/**
 * Which model wrote each answer, by message id.
 *
 * Deliberately takes the narrowest possible shape rather than the router's
 * message rows. Mapping over those directly makes TypeScript walk the recursive
 * JSON type behind `parts` — which it gives up on with "type instantiation is
 * excessively deep". Naming only the two fields this actually reads keeps the
 * assignability check shallow, and says plainly what it depends on.
 */
export function providersById(
  messages: readonly { id: string; provider?: string | null }[],
): Record<string, string | null> {
  return Object.fromEntries(
    messages.map((message) => [message.id, message.provider ?? null]),
  );
}
