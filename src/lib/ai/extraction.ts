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

import {
  documentViewerKind,
  type DocumentViewerKind,
} from "@/lib/document-file-types";

/**
 * Getting a document's words out, one page at a time.
 *
 * Deliberately *not* a model's job. Everything a citation claims — "page 5" —
 * rests on knowing which page a sentence was actually on, and a model handed a
 * whole PDF and asked to number what it reads will drift by a page somewhere in
 * the middle of a long document and never mention it. The file format already
 * knows the answer exactly, so this reads it from there and the model is only
 * asked for the things it is genuinely better at: what the document is about,
 * how it is structured, what to call its chapters.
 *
 * That division is also what makes processing affordable. A three-hundred-page
 * textbook costs nothing to split here, and only its outline is ever put in
 * front of a model.
 *
 * The one case that does need a model is a scanned document — pages that are
 * pictures of text, where there are no words to extract. That is detected here
 * and handled in `document-processing.ts`, which has the models.
 */

/** One page, as it came out of the file. */
export interface ExtractedPage {
  /** 1-based, as printed. Never an array index — citations read this aloud. */
  page: number;
  text: string;
}

export interface ExtractionResult {
  pages: ExtractedPage[];
  /**
   * Whether the file yielded so little text that it is probably scanned images
   * rather than text — the signal for `document-processing.ts` to ask a model
   * to read it instead.
   */
  looksScanned: boolean;
  kind: DocumentViewerKind;
}

/** Raised for formats there is no reader for, so the caller can say which. */
export class UnsupportedDocumentError extends Error {
  constructor(name: string) {
    super(
      `"${name}" is in a format that cannot be read for chat. ` +
        "Save it as a PDF and upload it again.",
    );
    this.name = "UnsupportedDocumentError";
  }
}

/**
 * Below this many characters per page, assume the pages are images.
 *
 * A genuinely text-bearing page carries hundreds of characters; a scanned one
 * carries a handful of stray marks the extractor mistook for glyphs, or none at
 * all. Set low on purpose — the cost of a false positive is an expensive model
 * call on a document that did not need one, and the cost of a false negative is
 * a document that chat cannot see at all.
 */
const SCANNED_CHARS_PER_PAGE = 40;

/** Collapses the whitespace PDF extraction leaves behind. */
function tidy(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    // Runs of blank lines become one. PDF extraction emits a lot of these.
    .replace(/\n{3,}/g, "\n\n")
    // Spaces and tabs, but never newlines — the line structure is worth
    // keeping, because it is what makes headings still look like headings.
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/**
 * Pages of a PDF.
 *
 * `mergePages: false` is the whole point: one string per page, in order, which
 * is what every page number downstream is counted from.
 */
async function extractPdf(bytes: Uint8Array): Promise<ExtractedPage[]> {
  // Imported here rather than at the top of the file so that the PDF.js build
  // behind it is only loaded when a PDF actually turns up. It is the largest
  // dependency in this path and most documents in a run will not need it.
  const { extractText, getDocumentProxy } = await import("unpdf");

  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: false });

  return text.map((pageText, index) => ({
    page: index + 1,
    text: tidy(pageText),
  }));
}

/**
 * A .docx, as one long section.
 *
 * Word documents have no fixed pages — where a page breaks depends on the
 * reader's paper size and fonts, so there is no true page 5 to cite. Rather
 * than invent one, the text is split into even blocks and numbered; the number
 * then means "roughly this far in", which is the most honest thing it can mean
 * for this format. The chat's citations read the same either way.
 */
async function extractDocx(bytes: Uint8Array): Promise<ExtractedPage[]> {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.extractRawText({
    buffer: Buffer.from(bytes),
  });

  return paginate(tidy(value));
}

/**
 * Slides of a .pptx, which really are pages: slide 3 is page 3, always.
 *
 * A .pptx is a zip of XML. `<a:t>` is the element that holds a run of text in
 * DrawingML, whatever shape it sits in, so pulling those out gets the words
 * without needing to understand slide layout.
 */
async function extractPptx(bytes: Uint8Array): Promise<ExtractedPage[]> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(bytes);

  const slidePaths = Object.keys(zip.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    // Sorted numerically, not lexically: string order puts slide10 before
    // slide2, which would renumber the back half of any deck over nine slides.
    .sort((a, b) => slideNumber(a) - slideNumber(b));

  const pages: ExtractedPage[] = [];

  for (const [index, path] of slidePaths.entries()) {
    const xml = await zip.files[path].async("string");

    // Every run of text on the slide, in document order — which is reading
    // order closely enough for a search index.
    const runs = [...xml.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)].map(
      (match) => decodeXmlEntities(match[1]),
    );

    pages.push({ page: index + 1, text: tidy(runs.join(" ")) });
  }

  return pages;
}

function slideNumber(path: string): number {
  return Number(path.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
}

/** The five predefined XML entities. Nothing else appears in `<a:t>`. */
function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    // Last, so a literal `&amp;lt;` does not become `<`.
    .replace(/&amp;/g, "&");
}

/** Roughly a page of prose, for formats that have no pages of their own. */
const CHARS_PER_SYNTHETIC_PAGE = 2_500;

/**
 * Cuts a continuous document into numbered blocks.
 *
 * Breaks are looked for at a paragraph boundary near the target size rather
 * than taken at exactly that offset, so a block rarely starts mid-sentence.
 */
function paginate(text: string): ExtractedPage[] {
  if (!text) return [];

  const pages: ExtractedPage[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const target = cursor + CHARS_PER_SYNTHETIC_PAGE;
    if (target >= text.length) {
      pages.push({ page: pages.length + 1, text: text.slice(cursor).trim() });
      break;
    }

    // Search a window after the target for a paragraph break; settle for the
    // hard offset if the text has none, which happens with unbroken tables.
    const window = text.indexOf("\n\n", target);
    const end =
      window !== -1 && window - target < CHARS_PER_SYNTHETIC_PAGE / 2
        ? window
        : target;

    pages.push({ page: pages.length + 1, text: text.slice(cursor, end).trim() });
    cursor = end;
  }

  return pages.filter((page) => page.text.length > 0);
}

/**
 * Reads a document's pages, whatever it happens to be.
 *
 * The file name decides the reader, because that is what the drive knows — the
 * bytes were validated at upload time by MIME type, and the extension has been
 * preserved through renames precisely so it can still be trusted here (see
 * `keepExtension`).
 */
export async function extractPages(
  bytes: Uint8Array,
  fileName: string,
): Promise<ExtractionResult> {
  const kind = documentViewerKind(fileName);

  // The pre-2007 binary formats, which `documentViewerKind` reports as null for
  // the same reason it matters here: `mammoth` and the zip reader below both
  // understand only the XML ones, and a wrong reader produces mojibake rather
  // than an error — which would be indexed and then cited as if it were the
  // document's actual words.
  if (kind === null) throw new UnsupportedDocumentError(fileName);

  const pages = await (async () => {
    switch (kind) {
      case "pdf":
        return extractPdf(bytes);
      case "docx":
        return extractDocx(bytes);
      case "pptx":
        return extractPptx(bytes);
    }
  })();

  const characters = pages.reduce((sum, page) => sum + page.text.length, 0);

  return {
    pages,
    kind,
    looksScanned:
      pages.length > 0 && characters / pages.length < SCANNED_CHARS_PER_PAGE,
  };
}
