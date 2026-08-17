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

import { tool } from "ai";
import z from "zod";

import {
  readPages,
  searchChunks,
  type RetrievedChunk,
} from "@/lib/ai/retrieval";

/**
 * What the model can do besides talk.
 *
 * The chat does not get the documents handed to it up front. It gets a
 * catalogue of what exists — see `prompt.ts` — and these two tools to go and
 * look things up with. That is deliberate and it is what makes the thing
 * scale: stuffing every page of every upload into a prompt stops working at the
 * second textbook, whereas searching works the same at two documents and two
 * hundred.
 *
 * It also produces better answers than one-shot retrieval. A question like
 * "compare how my two textbooks define osmosis" is two searches and a
 * comparison, and the model is allowed to make both. Search, read, search
 * again, then answer.
 *
 * Every tool closes over `userId`. Not one of them accepts it as an argument —
 * that is the whole security model here. The model composes its own tool
 * inputs, so anything it could name it could name wrongly; by construction it
 * cannot ask for another user's documents, because there is no parameter in
 * which to do so.
 */

/** How a passage is handed back to the model, citation fields first. */
function toCitation(chunk: RetrievedChunk) {
  return {
    documentId: chunk.documentId,
    /** What to call it in an answer: the printed title, else the file name. */
    document: chunk.documentTitle ?? chunk.documentName,
    subject: chunk.subject,
    section: chunk.section,
    // Kept as two fields rather than a pre-formatted "pages 4–5" string so the
    // model states the range the way the sentence needs it.
    pageStart: chunk.pageStart,
    pageEnd: chunk.pageEnd,
    text: chunk.text,
  };
}

/**
 * The tools for a chat, scoped by what it is allowed to see.
 *
 * `documentId` is the entire difference between the universal chat and a
 * document's own. Passed, the search is pinned to that document and the model
 * is given no way to widen it; absent, search runs across everything the user
 * owns and takes an optional document filter of its own.
 */
export function chatTools({
  userId,
  documentId,
}: {
  userId: string;
  /** Pins the chat to one document. Null for the universal chat. */
  documentId?: string | null;
}) {
  const scoped = documentId != null;

  const searchDocuments = tool({
    description: scoped
      ? "Search this document for passages relevant to a question. Returns " +
        "passages with the pages they are on. Search more than once with " +
        "different wording if the first search does not find what you need."
      : "Search across all of the user's uploaded documents for relevant " +
        "passages. Returns passages with the document and pages they are on. " +
        "Use the optional documentId to search within one document once you " +
        "know which one is relevant.",
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          "The search terms. Use the words that would appear in the document " +
            "itself rather than the user's phrasing — search for 'osmosis " +
            "semipermeable membrane', not 'how does osmosis work'. Quoted " +
            "phrases and a leading minus to exclude a term both work.",
        ),
      ...(scoped
        ? {}
        : {
            documentId: z
              .string()
              .nullish()
              .describe(
                "Restrict the search to one document, by the id given in the " +
                  "document list. Omit to search everything.",
              ),
          }),
      limit: z
        .number()
        .int()
        .min(1)
        .max(20)
        .nullish()
        .describe("How many passages to return. Defaults to 8."),
    }),
    execute: async (input) => {
      const requested = (input as { documentId?: string | null }).documentId;

      const chunks = await searchChunks({
        userId,
        // The scoped chat's pin wins outright. A model that invents a
        // `documentId` in a document chat — which it has no schema field for,
        // but tool inputs are not a guarantee — cannot widen its own scope.
        documentId: scoped ? documentId : (requested ?? null),
        query: input.query,
        limit: input.limit ?? undefined,
      });

      return {
        found: chunks.length,
        passages: chunks.map(toCitation),
      };
    },
  });

  const readDocumentPages = tool({
    description: scoped
      ? "Read the full text of a range of pages from this document, in order. " +
        "Use this after searching to read around a passage, or to work " +
        "through a whole section."
      : "Read the full text of a range of pages from one document, in order. " +
        "Use this after searching, to read around a passage or work through a " +
        "whole chapter.",
    inputSchema: z.object({
      ...(scoped
        ? {}
        : {
            documentId: z
              .string()
              .describe("Which document to read, by id."),
          }),
      from: z.number().int().min(1).describe("First page, 1-based, inclusive."),
      to: z
        .number()
        .int()
        .min(1)
        .describe(
          "Last page, inclusive. At most 12 pages are returned at a time; " +
            "ask for a further range if you need more.",
        ),
    }),
    execute: async (input) => {
      const target = scoped
        ? documentId
        : (input as { documentId?: string }).documentId;

      if (!target) {
        return { found: 0, passages: [], error: "No document was named." };
      }

      const chunks = await readPages({
        userId,
        documentId: target,
        from: input.from,
        to: input.to,
      });

      return {
        found: chunks.length,
        passages: chunks.map(toCitation),
      };
    },
  });

  return { searchDocuments, readDocumentPages };
}

export type ChatTools = ReturnType<typeof chatTools>;
