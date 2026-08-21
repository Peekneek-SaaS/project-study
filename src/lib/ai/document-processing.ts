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

import { generateText, Output } from "ai";
import z from "zod";

import {
  extractPages,
  stripUnstorable,
  type ExtractedPage,
} from "@/lib/ai/extraction";
import { createFallbackModel } from "@/lib/ai/providers";
import type { AiProvider } from "@/lib/ai/types";
import { isPdf, stripExtension } from "@/lib/document-file-types";

/**
 * Turning an uploaded file into something the chat can answer from.
 *
 * Runs once per document, in the background — see `trigger/document.ts`. What
 * it produces is the *only* thing either chat surface ever reads: the universal
 * chat searches every document's chunks, a document's own chat searches one
 * document's chunks, and neither has a second copy of anything. That is the
 * point of doing it here rather than at question time. Processing a document
 * twice, once "for itself" and once "for everything", would cost twice as much
 * and leave two readings to disagree with each other.
 *
 * Three passes, in order of how much they cost:
 *
 *   1. The words, read out of the file itself. Free, exact, and where every
 *      page number comes from.
 *   2. The structure — title, subject, chapters — asked of a model, because
 *      that is a judgement rather than a lookup. One call for the whole
 *      document, over an outline of it rather than the whole text.
 *   3. Transcription, only for scanned documents, where pass one found nothing
 *      because the pages are pictures. The expensive one, so it is the one that
 *      almost never runs.
 */

/**
 * How much text a chunk aims to hold.
 *
 * The unit of retrieval, so it is sized for the job it does: big enough that a
 * hit carries the surrounding argument and not just the sentence with the
 * keyword in it, small enough that ten of them fit in a prompt with room left
 * for the conversation. Roughly a page and a half of prose.
 */
const CHUNK_TARGET_CHARS = 3_000;

/**
 * The ceiling on a single chunk before it is split mid-page.
 *
 * Reached by dense pages — reference tables, slide notes — where one page alone
 * is longer than the target.
 */
const CHUNK_MAX_CHARS = 4_500;

/** How much of each page is shown to the model when it maps out the structure. */
const OUTLINE_CHARS_PER_PAGE = 240;

/** The ceiling on that whole summary, so a huge book cannot blow the context. */
const OUTLINE_MAX_CHARS = 120_000;

/**
 * The most pages a scanned document will be transcribed for.
 *
 * A guard on cost rather than on capability. Beyond this the document is still
 * processed — whatever text pass one did find is indexed — it just does not get
 * an expensive full read.
 */
export const MAX_SCANNED_PAGES = 60;

export interface DocumentChunkDraft {
  index: number;
  pageStart: number;
  pageEnd: number;
  section: string | null;
  text: string;
}

export interface OutlineEntry {
  title: string;
  pageStart: number;
  pageEnd: number;
}

export interface ProcessedDocument {
  /** Whether a model was asked to read the pages as images. Priced separately. */
  transcribed: boolean;
  title: string | null;
  subject: string | null;
  summary: string;
  topics: string[];
  outline: OutlineEntry[];
  pageCount: number;
  chunks: DocumentChunkDraft[];
  /** Which provider and model produced the structure, after any fallback. */
  provider: AiProvider | null;
  model: string | null;
}

/**
 * What the model is asked for, and the shape it has to answer in.
 *
 * Everything is described in terms of what it will be *used for* rather than
 * what it is, because that is what gets a usable answer: "subject" alone
 * invites "Document"; saying it will be used to tell three chapter fours apart
 * gets "Biology".
 */
const structureSchema = z.object({
  title: z
    .string()
    .describe(
      "The document's real title as printed on it, not the file name. " +
        "Empty string if the document does not state one.",
    ),
  subject: z
    .string()
    .describe(
      "The field or course this belongs to, in one or two words — for " +
        "example 'Biology', 'Macroeconomics', 'Constitutional Law'. This is " +
        "used to tell apart several documents that all have a chapter 4, so " +
        "prefer the specific subject over a generic one. Empty string if unclear.",
    ),
  summary: z
    .string()
    .describe(
      "Three to five sentences on what this document covers and what a " +
        "reader would come to it for. Written so that someone choosing which " +
        "of their documents holds an answer could decide from this alone.",
    ),
  topics: z
    .array(z.string())
    .describe(
      "Between five and fifteen specific topics, concepts or terms covered. " +
        "Prefer the document's own terminology.",
    ),
  outline: z
    .array(
      z.object({
        title: z
          .string()
          .describe(
            "The chapter or section heading as printed, including its number " +
              "if it has one — for example 'Chapter 4: Cell Structure'.",
          ),
        pageStart: z.number().int().describe("First page, 1-based."),
        pageEnd: z.number().int().describe("Last page, inclusive."),
      }),
    )
    .describe(
      "The document's chapters or major sections in order, with the pages " +
        "each runs over. Every page should fall inside exactly one entry. " +
        "Return an empty array for a document with no headings at all.",
    ),
});

/** Pages, condensed to the beginnings that headings live in. */
function outlineDigest(pages: ExtractedPage[]): string {
  const lines: string[] = [];
  let total = 0;

  for (const page of pages) {
    const head = page.text.slice(0, OUTLINE_CHARS_PER_PAGE).replace(/\n/g, " ");
    const line = `[page ${page.page}] ${head}`;

    if (total + line.length > OUTLINE_MAX_CHARS) break;
    lines.push(line);
    total += line.length;
  }

  return lines.join("\n");
}

/**
 * Asks a model what the document is.
 *
 * Failures are swallowed rather than propagated. A document with no outline is
 * still perfectly searchable — chunks carry their page numbers regardless, and
 * citations fall back to naming the document and page without a chapter. Losing
 * the whole document from chat because the structure pass had a bad minute
 * would be a much worse trade, so this returns nulls and lets processing finish.
 */
async function describeDocument(
  pages: ExtractedPage[],
  fileName: string,
  preferred?: AiProvider | null,
): Promise<
  Pick<
    ProcessedDocument,
    | "title"
    | "subject"
    | "summary"
    | "topics"
    | "outline"
    | "provider"
    | "model"
  >
> {
  const empty = {
    title: null,
    subject: null,
    summary: "",
    topics: [],
    outline: [],
    provider: null,
    model: null,
  };

  if (pages.length === 0) return empty;

  try {
    const fallback = createFallbackModel("extraction", preferred);

    // `generateText` with an `Output` spec rather than `generateObject`, which
    // the SDK deprecated in v6 and will remove: same one call, same validated
    // object, and `output` throws rather than returning something half-shaped
    // if the model answers with nothing the schema accepts — which the catch
    // below already treats as "no structure for this document".
    const { output } = await generateText({
      model: fallback.model,
      output: Output.object({ schema: structureSchema }),
      instructions:
        "You catalogue study documents so they can be searched and cited " +
        "accurately. You are given the opening of every page, in order. Work " +
        "only from what is there: never invent a chapter, a page number or a " +
        "topic that the text does not support. Page numbers you return must " +
        "be the [page N] markers as given.",
      prompt: [
        `File name: ${fileName}`,
        `Total pages: ${pages.length}`,
        "",
        "Page openings:",
        outlineDigest(pages),
      ].join("\n"),
    });

    const used = fallback.resolved();

    return {
      // Every string is run through `stripUnstorable` on the way out. A model
      // asked to transcribe a document with a broken encoding will happily echo
      // the NUL bytes back, and one of those anywhere in a summary is enough for
      // Postgres to reject the whole write.
      //
      // Empty strings are the schema's way of saying "not stated" — turned into
      // nulls here so the database holds one kind of absence, not two.
      title: stripUnstorable(output.title).trim() || stripExtension(fileName),
      subject: stripUnstorable(output.subject).trim() || null,
      summary: stripUnstorable(output.summary).trim(),
      topics: output.topics
        .map((topic) => stripUnstorable(topic).trim())
        .filter(Boolean),
      outline: sanitiseOutline(output.outline, pages.length),
      provider: used?.provider ?? null,
      model: used?.model ?? null,
    };
  } catch (error) {
    console.error("[ai] could not describe document", { fileName, error });
    return { ...empty, title: stripExtension(fileName) };
  }
}

/**
 * Keeps the outline honest about pages.
 *
 * A model asked for page ranges will occasionally hand back one that runs past
 * the end of the document, or backwards. Those are not worth failing the whole
 * job over, but they are worth not storing: an out-of-range range would label
 * chunks with a chapter they are not in, and a citation would then say
 * something false with complete confidence.
 */
function sanitiseOutline(
  entries: OutlineEntry[],
  pageCount: number,
): OutlineEntry[] {
  return entries
    .map((entry) => ({
      title: stripUnstorable(entry.title).trim(),
      pageStart: Math.max(1, Math.min(pageCount, Math.round(entry.pageStart))),
      pageEnd: Math.max(1, Math.min(pageCount, Math.round(entry.pageEnd))),
    }))
    .filter(
      (entry) => entry.title.length > 0 && entry.pageStart <= entry.pageEnd,
    )
    .sort((a, b) => a.pageStart - b.pageStart);
}

/** Which chapter a page falls in, or null if the outline does not cover it. */
function sectionForPage(outline: OutlineEntry[], page: number): string | null {
  const entry = outline.find(
    (candidate) => page >= candidate.pageStart && page <= candidate.pageEnd,
  );
  return entry?.title ?? null;
}

/**
 * Cuts pages into passages.
 *
 * Chunks accumulate whole pages until they reach the target, so a chunk's page
 * range is always exact rather than approximate. The exception is a page longer
 * than `CHUNK_MAX_CHARS` on its own, which is split at paragraph boundaries into
 * several chunks that all carry the same page number — still exact, just no
 * longer one-to-one.
 */
function buildChunks(
  pages: ExtractedPage[],
  outline: OutlineEntry[],
): DocumentChunkDraft[] {
  const chunks: DocumentChunkDraft[] = [];

  let buffer: string[] = [];
  let bufferChars = 0;
  let pageStart: number | null = null;
  let pageEnd = 0;

  const flush = () => {
    if (pageStart === null || buffer.length === 0) return;

    const text = buffer.join("\n\n").trim();
    if (text.length > 0) {
      chunks.push({
        index: chunks.length,
        pageStart,
        pageEnd,
        // Labelled by where the chunk *starts*: a passage spanning a chapter
        // boundary belongs to the chapter it opens in, which is the one a
        // reader would say it was in.
        section: sectionForPage(outline, pageStart),
        text,
      });
    }

    buffer = [];
    bufferChars = 0;
    pageStart = null;
  };

  for (const page of pages) {
    if (page.text.length === 0) continue;

    // A page too big to share a chunk with anything gets chunks of its own.
    if (page.text.length > CHUNK_MAX_CHARS) {
      flush();

      for (const piece of splitLongText(page.text)) {
        chunks.push({
          index: chunks.length,
          pageStart: page.page,
          pageEnd: page.page,
          section: sectionForPage(outline, page.page),
          text: piece,
        });
      }
      continue;
    }

    if (bufferChars + page.text.length > CHUNK_TARGET_CHARS) flush();

    if (pageStart === null) pageStart = page.page;
    pageEnd = page.page;
    buffer.push(page.text);
    bufferChars += page.text.length;
  }

  flush();

  return chunks;
}

/** Splits an oversized page at paragraph breaks, falling back to hard cuts. */
function splitLongText(text: string): string[] {
  const pieces: string[] = [];
  let current: string[] = [];
  let length = 0;

  for (const paragraph of text.split(/\n{2,}/)) {
    // A single paragraph over the limit — an unbroken table, usually. Cut it
    // rather than let one chunk swallow the page.
    if (paragraph.length > CHUNK_MAX_CHARS) {
      if (current.length > 0) {
        pieces.push(current.join("\n\n"));
        current = [];
        length = 0;
      }
      for (let at = 0; at < paragraph.length; at += CHUNK_TARGET_CHARS) {
        pieces.push(paragraph.slice(at, at + CHUNK_TARGET_CHARS));
      }
      continue;
    }

    if (length + paragraph.length > CHUNK_TARGET_CHARS && current.length > 0) {
      pieces.push(current.join("\n\n"));
      current = [];
      length = 0;
    }

    current.push(paragraph);
    length += paragraph.length;
  }

  if (current.length > 0) pieces.push(current.join("\n\n"));

  return pieces.map((piece) => piece.trim()).filter(Boolean);
}

/** What a model returns when asked to read a scanned document. */
const transcriptionSchema = z.object({
  pages: z.array(
    z.object({
      page: z.number().int().describe("The page number, 1-based, in order."),
      text: z.string().describe("Everything written on that page, verbatim."),
    }),
  ),
});

/**
 * Reads a scanned document with a model, because there is nothing to extract.
 *
 * Only attempted for PDFs: the file is handed to the model whole, and PDF is
 * the one document format all three providers accept as an attachment. A
 * scanned .docx is not really a thing, and a picture-only .pptx is rare enough
 * to leave to the empty-content path.
 *
 * Returns null rather than throwing on failure, so a document that cannot be
 * transcribed still gets a row saying so instead of a job that keeps retrying.
 */
async function transcribeScanned(
  bytes: Uint8Array,
  fileName: string,
  pageCount: number,
  preferred?: AiProvider | null,
): Promise<ExtractedPage[] | null> {
  if (!isPdf(fileName)) return null;
  if (pageCount > MAX_SCANNED_PAGES) return null;

  try {
    const fallback = createFallbackModel("extraction", preferred);

    const { output } = await generateText({
      model: fallback.model,
      output: Output.object({ schema: transcriptionSchema }),
      instructions:
        "You transcribe scanned documents. Return the text of every page in " +
        "order, exactly as written, preserving headings. Do not summarise, " +
        "translate or comment. If a page is blank, return an empty string for it.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Transcribe all ${pageCount} pages of this document.`,
            },
            {
              type: "file",
              data: bytes,
              mediaType: "application/pdf",
              filename: fileName,
            },
          ],
        },
      ],
    });

    const pages = output.pages
      .filter((page) => Number.isFinite(page.page) && page.page >= 1)
      .map((page) => ({
        page: Math.round(page.page),
        // These never pass through `tidy`, so this is the only place a
        // transcription's control characters get removed.
        text: stripUnstorable(page.text).trim(),
      }))
      .sort((a, b) => a.page - b.page);

    return pages.length > 0 ? pages : null;
  } catch (error) {
    console.error("[ai] could not transcribe scanned document", {
      fileName,
      error,
    });
    return null;
  }
}

/**
 * Reads a document end to end and returns everything worth storing.
 *
 * Pure with respect to the database — it takes bytes and returns data. The
 * writing is the task's job in `trigger/document.ts`, which keeps this testable
 * against a file on disk and keeps the transaction in one place.
 */
export async function processDocument({
  bytes,
  fileName,
  preferredProvider,
  onExtracted,
}: {
  bytes: Uint8Array;
  fileName: string;
  preferredProvider?: AiProvider | null;
  /**
   * Called once the pages are out and before anything is paid for.
   *
   * The seam billing hangs on, and the position is the whole point of it.
   * Extraction is local — `unpdf` and `mammoth`, no network, no tokens — so by
   * the time this runs the page count is known and nothing has cost anything
   * yet. A caller that throws here has refused a document without having been
   * billed for the privilege of looking at it.
   *
   * It also answers whether this document may be transcribed. A scanned PDF is
   * the most expensive thing this pipeline can do, so "may I OCR" is a question
   * asked with the real page count in hand rather than a flag guessed at from
   * the file name.
   */
  onExtracted?: (info: {
    pageCount: number;
    looksScanned: boolean;
  }) => Promise<{ allowOcr: boolean }> | { allowOcr: boolean };
}): Promise<ProcessedDocument> {
  const extracted = await extractPages(bytes, fileName);

  const permission = onExtracted
    ? await onExtracted({
        pageCount: extracted.pages.length,
        looksScanned: extracted.looksScanned,
      })
    : { allowOcr: true };

  // Pages that are pictures of text. Whatever the extractor did find is kept as
  // the fallback, so a failed transcription still leaves the document better
  // than nothing — which is also what a plan that does not include OCR gets.
  const needsOcr = extracted.looksScanned || extracted.pages.length === 0;
  const pages =
    needsOcr && permission.allowOcr
      ? ((await transcribeScanned(
          bytes,
          fileName,
          extracted.pages.length,
          preferredProvider,
        )) ?? extracted.pages)
      : extracted.pages;

  const described = await describeDocument(pages, fileName, preferredProvider);
  const chunks = buildChunks(pages, described.outline);

  return {
    ...described,
    pageCount: pages.length,
    chunks,
    // Reported so the task can bill for what actually happened rather than for
    // what it expected: a document that looked scanned but whose transcription
    // came back empty has not had an OCR pass worth charging for.
    transcribed: needsOcr && permission.allowOcr && pages !== extracted.pages,
  };
}
