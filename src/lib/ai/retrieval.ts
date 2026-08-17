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

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Finding the passages an answer should be built from.
 *
 * The same three functions serve both chats. The only difference between "ask
 * anything about everything I have uploaded" and "ask about this one document"
 * is whether `documentId` is passed — which is why processing happens once per
 * document and there is no separate universal index to keep in step. The
 * universal corpus *is* the per-document corpus, unfiltered.
 *
 * Postgres full-text search rather than embeddings. Two reasons, in order of
 * how much they matter: an embedding index would have to be built by one
 * provider, and this app's whole premise is that no single provider is
 * load-bearing — vectors from OpenAI and vectors from Gemini do not live in the
 * same space, so a fallback would silently return nonsense rather than
 * degrading. And study documents are full of the exact terms people ask about
 * by name, which is the case lexical search is strongest at. The model makes up
 * the difference by being able to search more than once and to read whole pages
 * — see `chat/server/tools.ts`.
 */

/** A passage, with everything a citation needs to name it. */
export interface RetrievedChunk {
  documentId: string;
  /** The file's name in the drive — what the user calls it. */
  documentName: string;
  /** The title printed on the document, when it has one. */
  documentTitle: string | null;
  subject: string | null;
  section: string | null;
  pageStart: number;
  pageEnd: number;
  text: string;
}

/** How many passages a single search may return. */
const DEFAULT_SEARCH_LIMIT = 8;
const MAX_SEARCH_LIMIT = 20;

/** How many pages one `readPages` call may pull back. */
const MAX_PAGE_SPAN = 12;

/**
 * The shape the raw queries below select. Written out because `$queryRaw`
 * cannot infer it — the compiler believes whatever we claim here, so it is kept
 * identical to the `SELECT` lists and nothing else is added to it.
 */
interface ChunkRow {
  documentId: string;
  documentName: string;
  documentTitle: string | null;
  subject: string | null;
  section: string | null;
  pageStart: number;
  pageEnd: number;
  text: string;
}

/**
 * Only documents that finished being read are searchable.
 *
 * A `PROCESSING` document has a partial set of chunks in the table while the
 * job works, and a `FAILED` one may have the leftovers of an attempt. Either
 * would be cited as confidently as a complete document, so both are excluded
 * here rather than filtered by whoever remembers to.
 */
const READY_ONLY = Prisma.sql`dc.status = 'READY'`;

/**
 * Searches a user's documents, or one of them.
 *
 * `websearch_to_tsquery` rather than `plainto_tsquery` because it understands
 * what people actually type — quoted phrases, `or`, a leading `-` to exclude —
 * and, unlike `to_tsquery`, it cannot be made to throw by punctuation. That
 * matters more than it sounds: the query string here comes from a model
 * composing its own searches, and a syntax error would surface as a broken tool
 * rather than as no results.
 *
 * `ts_rank_cd` is cover density ranking: it scores passages where the search
 * terms appear *near each other* above ones that merely contain them all. For
 * prose that is the difference between the paragraph explaining a concept and
 * the index entry listing it.
 */
export async function searchChunks({
  userId,
  documentId,
  query,
  limit = DEFAULT_SEARCH_LIMIT,
}: {
  userId: string;
  documentId?: string | null;
  query: string;
  limit?: number;
}): Promise<RetrievedChunk[]> {
  const take = Math.min(Math.max(1, Math.trunc(limit)), MAX_SEARCH_LIMIT);

  // Narrowing to one document is a `WHERE` clause and nothing else — the whole
  // difference between the two chat surfaces.
  const scope = documentId
    ? Prisma.sql`AND c."documentId" = ${documentId}`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<ChunkRow[]>`
    SELECT
      c."documentId"   AS "documentId",
      d."name"         AS "documentName",
      dc."title"       AS "documentTitle",
      dc."subject"     AS "subject",
      c."section"      AS "section",
      c."pageStart"    AS "pageStart",
      c."pageEnd"      AS "pageEnd",
      c."text"         AS "text"
    FROM "DocumentChunk" c
    JOIN "Document" d ON d."id" = c."documentId"
    JOIN "DocumentContent" dc ON dc."id" = c."contentId",
      websearch_to_tsquery('english', ${query}) AS q
    WHERE c."userId" = ${userId}
      AND ${READY_ONLY}
      AND c."searchVector" @@ q
      ${scope}
    ORDER BY ts_rank_cd(c."searchVector", q) DESC, c."index" ASC
    LIMIT ${take}
  `;

  // A query of nothing but stop words ("what is it about") produces an empty
  // tsquery, which matches nothing at all. Rather than report "not in this
  // document" — which for a document chat is an outright wrong answer — fall
  // back to the opening passages, which is what a person would skim first.
  if (rows.length === 0 && documentId) {
    return openingChunks({ userId, documentId, limit: take });
  }

  return rows;
}

/** The start of a document, for when a search has nothing to go on. */
async function openingChunks({
  userId,
  documentId,
  limit,
}: {
  userId: string;
  documentId: string;
  limit: number;
}): Promise<RetrievedChunk[]> {
  return prisma.$queryRaw<ChunkRow[]>`
    SELECT
      c."documentId"   AS "documentId",
      d."name"         AS "documentName",
      dc."title"       AS "documentTitle",
      dc."subject"     AS "subject",
      c."section"      AS "section",
      c."pageStart"    AS "pageStart",
      c."pageEnd"      AS "pageEnd",
      c."text"         AS "text"
    FROM "DocumentChunk" c
    JOIN "Document" d ON d."id" = c."documentId"
    JOIN "DocumentContent" dc ON dc."id" = c."contentId"
    WHERE c."userId" = ${userId}
      AND c."documentId" = ${documentId}
      AND ${READY_ONLY}
    ORDER BY c."index" ASC
    LIMIT ${limit}
  `;
}

/**
 * Everything on a range of pages, in reading order.
 *
 * The companion to search, and the reason the chat can answer questions search
 * alone cannot. "What does this chapter argue" is not a keyword lookup; having
 * found where chapter 4 starts, the model reads it. It is also how a citation
 * gets checked — the model can go and look at the page it is about to name.
 */
export async function readPages({
  userId,
  documentId,
  from,
  to,
}: {
  userId: string;
  documentId: string;
  from: number;
  to: number;
}): Promise<RetrievedChunk[]> {
  const start = Math.max(1, Math.trunc(from));
  // Clamped rather than refused: a model asking for a whole chapter at once is
  // doing the right thing, and the useful answer is the first dozen pages of it
  // rather than an error telling it to ask again more carefully.
  const end = Math.max(start, Math.min(Math.trunc(to), start + MAX_PAGE_SPAN - 1));

  return prisma.$queryRaw<ChunkRow[]>`
    SELECT
      c."documentId"   AS "documentId",
      d."name"         AS "documentName",
      dc."title"       AS "documentTitle",
      dc."subject"     AS "subject",
      c."section"      AS "section",
      c."pageStart"    AS "pageStart",
      c."pageEnd"      AS "pageEnd",
      c."text"         AS "text"
    FROM "DocumentChunk" c
    JOIN "Document" d ON d."id" = c."documentId"
    JOIN "DocumentContent" dc ON dc."id" = c."contentId"
    WHERE c."userId" = ${userId}
      AND c."documentId" = ${documentId}
      AND ${READY_ONLY}
      AND c."pageStart" <= ${end}
      AND c."pageEnd" >= ${start}
    ORDER BY c."index" ASC
  `;
}

/** A document as the chat's router sees it: enough to decide where to look. */
export interface DocumentDigest {
  id: string;
  name: string;
  title: string | null;
  subject: string | null;
  summary: string;
  topics: string[];
  pageCount: number;
  outline: { title: string; pageStart: number; pageEnd: number }[];
}

/**
 * The user's readable documents, with just enough of each to choose between
 * them.
 *
 * This is what makes the universal chat able to say *which* document an answer
 * came from rather than searching blindly: the summaries and topics go into the
 * system prompt, so before the model searches anything it already knows it owns
 * a biology textbook and two economics handouts. Small on purpose — a few
 * sentences each — because it is paid for on every single turn.
 */
export async function listReadableDocuments(
  userId: string,
): Promise<DocumentDigest[]> {
  const rows = await prisma.documentContent.findMany({
    where: { userId, status: "READY" },
    select: {
      documentId: true,
      title: true,
      subject: true,
      summary: true,
      topics: true,
      pageCount: true,
      outline: true,
      document: { select: { name: true } },
    },
    orderBy: { document: { createdAt: "desc" } },
  });

  return rows.map((row) => ({
    id: row.documentId,
    name: row.document.name,
    title: row.title,
    subject: row.subject,
    summary: row.summary,
    topics: row.topics,
    pageCount: row.pageCount,
    outline: parseOutline(row.outline),
  }));
}

/** One document's digest, for a document-scoped chat's system prompt. */
export async function readDocumentDigest(
  userId: string,
  documentId: string,
): Promise<DocumentDigest | null> {
  const row = await prisma.documentContent.findFirst({
    where: { userId, documentId, status: "READY" },
    select: {
      documentId: true,
      title: true,
      subject: true,
      summary: true,
      topics: true,
      pageCount: true,
      outline: true,
      document: { select: { name: true } },
    },
  });

  if (!row) return null;

  return {
    id: row.documentId,
    name: row.document.name,
    title: row.title,
    subject: row.subject,
    summary: row.summary,
    topics: row.topics,
    pageCount: row.pageCount,
    outline: parseOutline(row.outline),
  };
}

/**
 * Reads the stored outline back.
 *
 * Json in, so unknown out — the column was written by a model's answer, and a
 * row written by an older version of this app may not match today's shape.
 * Anything that does not is dropped rather than allowed into a prompt as
 * `undefined`.
 */
function parseOutline(value: unknown): DocumentDigest["outline"] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const { title, pageStart, pageEnd } = entry as Record<string, unknown>;
    if (
      typeof title !== "string" ||
      typeof pageStart !== "number" ||
      typeof pageEnd !== "number"
    ) {
      return [];
    }
    return [{ title, pageStart, pageEnd }];
  });
}
