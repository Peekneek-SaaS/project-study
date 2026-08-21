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

import type { DocumentDigest } from "@/lib/ai/retrieval";
import { DEFAULT_CITATIONS } from "@/lib/ai/types";
import {
  isWorkspaceEmpty,
  WORKSPACE_KINDS,
  type WorkspaceItem,
  type WorkspaceKind,
  type WorkspaceSnapshot,
} from "@/lib/ai/workspace";

/**
 * What each chat is told about itself before anyone says anything.
 *
 * Two prompts, because the two surfaces make different promises. The universal
 * chat's job is to find the right document among many and say which one it
 * used; a document's own chat has exactly one source and has to be willing to
 * say a question falls outside it. Everything else about them is the same, and
 * lives in `sharedRules` so it cannot drift.
 *
 * The catalogue is inlined rather than fetched by a tool. It is small — a few
 * sentences per document — and having it present from the first token is what
 * lets the model search once with good terms instead of searching three times
 * to work out what it owns.
 *
 * The same argument, made twice. Below the catalogue sits a snapshot of what
 * the user has *written*: their boards, sticky notes, annotations and todos.
 * Counts of all of it, contents of the most recent few, and `readWorkspace` for
 * the rest — because a question like "what was I stuck on" should not cost a
 * tool call, and an account with four hundred annotations should not cost a
 * prompt. Which documents that covers is the one difference between the two
 * surfaces: everything the user owns, or only this document's.
 */

/**
 * Whether this turn should show its sources.
 *
 * The user can turn citations off — see `use-chat-citations`. What that
 * switches off is the *display*, and nothing else: an uncited answer is still
 * searched for, still read out of the documents, and still refuses to invent.
 * The two rules at the top of `sharedRules` are identical in both modes on
 * purpose, because "do not cite" and "do not check" are entirely different
 * requests and only the first one is ever being made here.
 */
export interface PromptOptions {
  /**
   * Absent falls back to `DEFAULT_CITATIONS`. False writes plain prose with no
   * links and no page numbers.
   */
  cite?: boolean;
}

/**
 * How answers are expected to read, on both surfaces.
 *
 * The citation rule is written as a worked example rather than a format string
 * because that is what actually holds: given a shape to imitate, models cite
 * consistently; given a grammar to fill in, they produce citations that are
 * technically valid and unreadable.
 */
const CITED_RULES = `
How to answer:

- Search before you answer. Never answer a question about document content
  from memory or general knowledge, even when you are confident.
- Search more than once when the first search misses. Try the document's own
  vocabulary, not the user's phrasing.
- Cite where the answer came from, inline, as part of the sentence, and write
  every citation as a Markdown link with this exact form:

      [<what to call it>](doc:<documentId>?page=<page>)

  The documentId is the "documentId" field on the passage you are using,
  copied exactly. The page is that passage's "pageStart". For example:

      According to [Biology — Chapter 4, page 5](doc:clx9k2b0000abc?page=5),
      osmosis is the movement of water across a semipermeable membrane.

  The link text is what a reader sees, so write it the way a person would say
  it: the document, the chapter if there is one, and the page. Never show the
  raw id or the "doc:" target to the reader — it belongs only inside the
  parentheses.
- Always name the page. If the passage has a section or chapter, name that too.
- Never cite a page you have not actually seen in a search result or a page
  read, and never invent a documentId. If you are unsure of the page, say so in
  plain text rather than guessing a number inside a link.
- If the documents genuinely do not answer the question, say so plainly and say
  what they do cover that is close.
- Quote the document directly when the exact wording matters — a definition, a
  formula, a legal test. Otherwise explain it in your own words.
- Match the length of the answer to the question. A definition is a sentence,
  not an essay. Use headings and lists only when the answer really has parts.
- Use Markdown. Use LaTeX between $...$ for inline maths and $$...$$ for
  display maths.
`.trim();

/**
 * The same rules with the citations taken out.
 *
 * Note what is *not* different: the first two lines are word for word the ones
 * above. Turning citations off is a request about the prose, and a prompt that
 * quietly relaxed "search before you answer" alongside them would turn the
 * feature into "answer from memory" — which is the one thing this chat exists
 * not to do, and which the user would have no way of noticing.
 *
 * The prohibition is spelled out in three forms because models hedge: told only
 * "do not cite", they drop the Markdown link and keep a bare "(page 5)" at the
 * end of the sentence, which is the thing the user was trying to be rid of.
 */
const UNCITED_RULES = `
How to answer:

- Search before you answer. Never answer a question about document content
  from memory or general knowledge, even when you are confident.
- Search more than once when the first search misses. Try the document's own
  vocabulary, not the user's phrasing.
- Do not cite. The reader has turned citations off for now. That means no
  "doc:" links, no bracketed references, and no trailing "(page 5)" — just the
  answer, written as continuous prose.
- Being uncited does not make you freer. Everything you say still has to come
  from what you actually read. If the documents do not support it, do not say
  it.
- If they ask where something came from, tell them in plain words — the
  document, the section, the page — and then carry on without links.
- If the documents genuinely do not answer the question, say so plainly and say
  what they do cover that is close.
- Quote the document directly when the exact wording matters — a definition, a
  formula, a legal test. Otherwise explain it in your own words.
- Match the length of the answer to the question. A definition is a sentence,
  not an essay. Use headings and lists only when the answer really has parts.
- Use Markdown. Use LaTeX between $...$ for inline maths and $$...$$ for
  display maths.
`.trim();

/**
 * Whether this turn cites, resolved once.
 *
 * Every branch below reads this rather than testing `options.cite` for itself.
 * They used to, and it was a bug waiting for the default to move: a check
 * written as `options.cite === false` says "cited" when the field is absent,
 * which was right only for as long as the default happened to be on. Resolving
 * it in one place means the rules and the surrounding prose cannot end up
 * disagreeing about what kind of answer this is.
 */
function shouldCite(options: PromptOptions): boolean {
  return options.cite ?? DEFAULT_CITATIONS;
}

/** Whichever set of rules this turn was asked for. */
function sharedRules(options: PromptOptions): string {
  return shouldCite(options) ? CITED_RULES : UNCITED_RULES;
}

/** One document, as a line in the catalogue. */
function digestLine(digest: DocumentDigest): string {
  const parts = [
    `- id: ${digest.id}`,
    `  name: ${digest.title ?? digest.name}`,
  ];

  if (digest.subject) parts.push(`  subject: ${digest.subject}`);
  if (digest.pageCount > 0) parts.push(`  pages: ${digest.pageCount}`);
  if (digest.summary) parts.push(`  about: ${digest.summary}`);
  if (digest.topics.length > 0) {
    parts.push(`  topics: ${digest.topics.join(", ")}`);
  }
  if (digest.outline.length > 0) {
    parts.push(
      `  contents: ${digest.outline
        .map((entry) => `${entry.title} (p${entry.pageStart}-${entry.pageEnd})`)
        .join("; ")}`,
    );
  }

  return parts.join("\n");
}

/** Kinds in the order they are worth reading, and what to head each list. */
const KIND_HEADINGS: Record<WorkspaceKind, string> = {
  notes: "Sticky notes",
  annotations: "Annotations (notes written onto a page)",
  todos: "Todos",
  boards: "Boards (drawing canvases)",
};

/** The order above, as an order. */
const KIND_ORDER: readonly WorkspaceKind[] = [
  "notes",
  "annotations",
  "todos",
  "boards",
];

/**
 * A body, on one line.
 *
 * These are lists, and a note with four bullets in it would otherwise put four
 * unindented lines into the middle of one — at which point the model cannot
 * tell where one note ends and the next begins, which is the only thing the
 * list format has to get right.
 */
function oneLine(text: string): string {
  return text.replace(/\s*\n+\s*/g, " / ").trim();
}

/**
 * One item, written the way it would be said.
 *
 * `scoped` drops the document name from every line. In a document chat it is
 * the same name on all of them and the model is already told which document it
 * is looking at, so printing it forty times buys nothing.
 */
function workspaceLine(item: WorkspaceItem, scoped: boolean): string {
  const where = !scoped && item.document ? ` — ${item.document}` : "";

  switch (item.kind) {
    case "todos": {
      const parts = [`- [${item.done ? "x" : " "}] ${item.title}`];
      if (item.due) parts.push(` (due ${item.due}`);
      if (item.priority && item.priority !== "NONE") {
        parts.push(`, ${item.priority.toLowerCase()} priority`);
      }
      if (item.due) parts.push(")");
      return parts.join("") + where;
    }

    case "annotations": {
      const head = !scoped && item.document
        ? `${item.document}, page ${item.page}`
        : `Page ${item.page}`;
      const quote = item.quote ? ` on "${oneLine(item.quote)}"` : "";
      const said = item.text ? `: ${oneLine(item.text)}` : " (no note written)";
      return `- ${head}${quote}${said}`;
    }

    case "boards": {
      const size = item.elements ? ` (${item.elements} elements)` : "";
      const said = item.text ? `: ${oneLine(item.text)}` : " — nothing written on it";
      return `- ${item.title}${where}${size}${said}`;
    }

    case "notes": {
      const said = item.text ? `: ${oneLine(item.text)}` : "";
      return `- ${item.title}${where} (${item.updated})${said}`;
    }
  }
}

/**
 * The user's own work, as a section of the prompt.
 *
 * The counts are stated even where the items are not, and that is the part
 * worth being careful about: a model shown six notes and no count will say
 * "your six notes" about an account that has sixty. Every kind that has been
 * truncated says so and says what to call to see the rest, which turns a
 * potential lie into a tool call.
 */
function workspaceSection(
  snapshot: WorkspaceSnapshot,
  scoped: boolean,
): string {
  if (isWorkspaceEmpty(snapshot.counts)) return "";

  const tally = WORKSPACE_KINDS.filter((kind) => snapshot.counts[kind] > 0)
    .map((kind) => `${snapshot.counts[kind]} ${kind}`)
    .join(", ");

  const sections = KIND_ORDER.flatMap((kind) => {
    const items = snapshot.items.filter((item) => item.kind === kind);
    if (items.length === 0) return [];

    const total = snapshot.counts[kind];
    const more =
      total > items.length
        ? ` — showing ${items.length} of ${total}, call readWorkspace for the rest`
        : "";

    return [
      `${KIND_HEADINGS[kind]}${more}:\n${items
        .map((item) => workspaceLine(item, scoped))
        .join("\n")}`,
    ];
  });

  return `
${
    scoped
      ? "The user's own work on this document"
      : "The user's own work, across everything they have"
  } (${tally}):

${sections.join("\n\n")}
`.trim();
}

/**
 * How to treat the user's own work, which is not the same as a source.
 *
 * The distinction the rules below exist for: an annotation saying "this is
 * wrong" is evidence about the reader, not about the subject, and a model that
 * blends the two will happily report somebody's own half-remembered note back
 * to them as what the textbook says. Naming whose words they are on every use
 * is what keeps that from happening.
 */
function workspaceRules(cite: boolean): string {
  return `
The user's own work:

- Their notes, annotations, todos and boards are theirs, not the document's.
  Attribute them: "your note from Tuesday", "your annotation on page 5", "the
  todo you filed". Never present something they wrote as something the document
  says.
- Do not treat them as authoritative about the subject. If a note contradicts
  the document, trust the document and tell them plainly what you found — a
  wrong note is the single most useful thing you can catch for someone revising.
- An annotation names a real page of a real document, so it is a good place to
  start reading from. ${
    cite
      ? "You may cite that page in the normal way once you\n  have actually read it."
      : "Say which page it is on in plain words."
  }
- Use them without being asked when they make the answer better: what they have
  already annotated is what they are working on, and an unfinished todo is a
  standing question about what they need next.
- The lists above are the most recent few of each. When a question needs more —
  the whole of something, an older item, or a note they half remember — call
  readWorkspace rather than guessing or saying you cannot see it.
`.trim();
}

/**
 * The universal chat: everything the user has uploaded, at once.
 *
 * The instruction to name the subject is what makes the citations useful once a
 * drive has more than one course in it. "Chapter 4, page 5" is ambiguous across
 * three textbooks; "Biology, chapter 4, page 5" is not, and that is exactly the
 * sentence this surface exists to be able to write.
 */
export function universalSystemPrompt(
  digests: DocumentDigest[],
  workspace: WorkspaceSnapshot,
  options: PromptOptions = {},
): string {
  const cite = shouldCite(options);
  const workspaceText = workspaceSection(workspace, false);

  /*
    Nothing uploaded is not the same as nothing to talk about.

    This branch used to be the whole answer to an empty account, and with the
    workspace it is no longer true: someone can have written a fortnight of
    notes and a full week of todos without a single document having finished
    processing, and telling that person "you have nothing for me to look at"
    is a chat that is wrong about the state of their own app.
  */
  if (digests.length === 0) {
    if (!workspaceText) {
      return `
You are the study assistant for this app. The user has not uploaded any
documents that have finished processing yet, and has not written any notes,
annotations, todos or boards either — so you have nothing of theirs to look at.

Tell them so, warmly and briefly, and say that once they upload a PDF, Word or
PowerPoint file you will be able to answer questions from it and cite the exact
pages. Answer general study questions if they ask one, but be clear that you are
answering from general knowledge and not from their material.
`.trim();
    }

    return `
You are the study assistant for this app. The user has not uploaded any
documents that have finished processing yet, so there is nothing to search — but
they have been working, and you can see what they have written.

${workspaceText}

Answer from their own work where it is relevant, and say plainly when you are
answering from general knowledge instead. If they ask something that would need
a document, say that nothing has finished processing yet and that you will be
able to answer from it — and cite the pages — once one has.

Do not search the documents this turn. There are none to find, so searchDocuments
will come back empty however it is phrased; readWorkspace is the tool that has
something in it. The rules below about searching apply from the moment a
document is ready, which may be later in this same conversation.

${workspaceRules(cite)}

${sharedRules(options)}
`.trim();
  }

  return `
You are the study assistant for this app. You can search every document the
user has uploaded, you can see the notes, annotations, todos and boards they
have made, and you answer their questions from those.

The user's documents:

${digests.map(digestLine).join("\n")}

Work out which document is likely to hold the answer from the list above, then
search — narrowing to that document with its id when you are confident, and
searching everything when you are not. A question may need more than one
document, and comparing what two of them say is a fair question to be asked.

${workspaceText}

${
    cite
      ? `Because the user has several documents, always name which one you are quoting.
Use its subject where it has one, so that "chapter 4" is never ambiguous
between two courses: "According to Biology, chapter 4, page 5, ...".`
      : `Because the user has several documents, say which one an answer came from
when it is not obvious — in the sentence, in plain words, without a link. Naming
the subject is what stops "chapter 4" being ambiguous between two courses.`
  }

${workspaceText ? `${workspaceRules(cite)}\n\n` : ""}${sharedRules(options)}
`.trim();
}

/**
 * A single document's chat.
 *
 * The refusal is the defining behaviour of this surface, and it is written
 * carefully: the model is told to *decline and redirect*, not merely to say no.
 * A flat "not related to this PDF" to someone asking a reasonable follow-up
 * reads as a broken feature, whereas naming what the document does cover — and
 * pointing at the universal chat, which can see everything — is a refusal that
 * still moves the user forward.
 */
export function documentSystemPrompt(
  digest: DocumentDigest,
  workspace: WorkspaceSnapshot,
  options: PromptOptions = {},
): string {
  const cite = shouldCite(options);
  const workspaceText = workspaceSection(workspace, true);

  return `
You are the study assistant for one specific document, and you answer only from
that document and from what the user has written about it.

The document:

${digestLine(digest)}

You can search and read this document and nothing else. You have no access to
the user's other uploads.
${workspaceText ? `\n${workspaceText}\n` : ""}
Staying in scope:

- If the question can be answered from this document, answer it from this
  document.
- If it cannot, say so directly — "That isn't covered in this document" — then
  say in one sentence what this document does cover that is nearest to it, and
  mention that the main chat can search all of their documents.
- Do not answer from general knowledge instead. A confident answer from
  somewhere other than this document is exactly what this chat must not do.
- Ordinary conversation is not out of scope. Greetings, "what is this
  document?", "summarise chapter 2", and follow-up questions about your own
  previous answer are all fair, and none of them need a refusal.
- Neither is their own work on this document. Their notes, annotations, todos
  and boards for it are listed below and are as much in scope as the pages are
  — "what did I highlight in chapter 4" and "what have I still got to do on
  this" are questions this chat is for, not questions to decline. What is out
  of scope is the *other* documents, and the notes attached to those.
- Search before deciding that something is not covered. A question phrased
  differently from the document is not the same as a question the document does
  not answer.

${
    cite
      ? `Citations name the section and page; there is only one document here, so you do
not need to name it every time.`
      : `There is only one document here, so there is never any doubt about which one
an answer came from.`
  }

${workspaceText ? `${workspaceRules(cite)}\n\n` : ""}${sharedRules(options)}
`.trim();
}
