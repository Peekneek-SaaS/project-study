/**
 * No `server-only` marker here, deliberately.
 *
 * This module is imported by the Trigger.dev worker as well as by Next. That
 * package resolves to a file that throws on import unless React's
 * `react-server` condition is set, which a plain Node bundle does not set — so
 * the marker would not restrict this module, it would break every task that
 * reaches it.
 *
 * Nothing is lost by dropping it: everything here touches Prisma, which does
 * not survive a client bundle quietly.
 */

import { prisma } from "@/lib/prisma";

/**
 * What the user has made, as opposed to what they have uploaded.
 *
 * The documents are one half of what a chat should know about; this is the
 * other. Someone who has spent an evening annotating chapter four, written six
 * sticky notes about it and filed a todo to re-read it has told the app a great
 * deal about what they are studying and what they are stuck on — and until now
 * a chat could see none of it, which is why "what should I revise" could only
 * ever be answered out of the textbook rather than out of the reader's own
 * working.
 *
 * Four kinds, one shape. Boards, notes, annotations and todos are different
 * objects with different columns, and flattening them into one `WorkspaceItem`
 * is what lets the prompt and the tool render them with one function each
 * rather than four. What is lost by flattening — the appearance fields, the
 * anchor fractions, the timer — is exactly what a model has no use for.
 *
 * The scoping rule is the same one `retrieval.ts` uses, for the same reason:
 * `documentId` passed narrows every query to that document, absent reads
 * everything the user owns. The universal chat and a document's own chat are
 * the same code with one argument different, so the two cannot drift.
 */

/** The four things a user makes for themselves. */
export const WORKSPACE_KINDS = [
  "boards",
  "notes",
  "annotations",
  "todos",
] as const;

export type WorkspaceKind = (typeof WORKSPACE_KINDS)[number];

/**
 * One board, note, annotation or todo, as the model reads it.
 *
 * Optional fields rather than a discriminated union, and this is a deliberate
 * trade: a union would be more honest about which kinds carry a page and which
 * carry a due date, and it would make every function here a four-armed switch
 * over shapes that are 80% identical. The renderers skip what is absent.
 */
export interface WorkspaceItem {
  kind: WorkspaceKind;
  id: string;
  /** The document this belongs to, or null when it stands on its own. */
  documentId: string | null;
  /** That document's name, for saying which one without a second lookup. */
  document: string | null;
  /** What to call it: the note's first line, the todo's title, the board's name. */
  title: string;
  /** The words in it, flattened out of HTML or out of a canvas. */
  text: string;
  /** Annotations only: the page the note was written on. */
  page?: number;
  /** Annotations only: the sentence that was selected. */
  quote?: string;
  /** Todos only: the day it is filed under, `yyyy-MM-dd`. */
  due?: string;
  /** Todos only. */
  priority?: string;
  /** Todos only — whether it is ticked. */
  done?: boolean;
  /** Boards only: how many elements are on the canvas. */
  elements?: number;
  /** The day it last changed, `yyyy-MM-dd`. */
  updated: string;
}

/** How many of each kind a workspace holds, before anything is truncated. */
export type WorkspaceCounts = Record<WorkspaceKind, number>;

/**
 * What goes in a system prompt: the counts, and the most recent few of each.
 *
 * Both halves matter and they are not the same thing. The items are what lets
 * the model answer without a tool call; the counts are what tells it — and lets
 * it tell the user — that there are ninety more where those came from. A
 * snapshot without its counts reads as the whole truth and quietly is not.
 */
export interface WorkspaceSnapshot {
  counts: WorkspaceCounts;
  items: WorkspaceItem[];
}

/** How many of each kind the prompt carries. The tool fetches the rest. */
const SNAPSHOT_PER_KIND = 8;

/** How long any one item's text may be in a snapshot, in characters. */
const SNAPSHOT_TEXT = 300;

/** The same, for a tool result — which is asked for, so it can afford more. */
const TOOL_TEXT = 1500;

/** How many items one tool call may return. */
const DEFAULT_TOOL_LIMIT = 20;
const MAX_TOOL_LIMIT = 50;

/** Whether a workspace has anything in it at all. */
export function isWorkspaceEmpty(counts: WorkspaceCounts): boolean {
  return WORKSPACE_KINDS.every((kind) => counts[kind] === 0);
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

/**
 * A note's HTML, as the words in it.
 *
 * Notes and annotations are stored as the HTML their editor writes — see
 * `note-html.ts` — and handing that to a model verbatim spends tokens on
 * `<b>` and teaches it to answer in markup. The tags come out and the block
 * ones become line breaks, so a bulleted list still reads as a list.
 *
 * Written here rather than borrowed from `sanitiseNoteHtml`, which needs a
 * `DOMParser`: this runs in a Trigger.dev worker, where there is no DOM at all
 * and that function returns an empty string. A regex is the wrong tool for
 * *sanitising* HTML and the right one for stripping it — nothing here is ever
 * rendered, so a tag that slips through is a stray angle bracket in a prompt
 * rather than a hole.
 */
export function htmlToText(html: string): string {
  return html
    // Contents and all, unlike every other tag. What is inside a `<script>` is
    // code, and unwrapping one puts `alert(1)` into a prompt as though somebody
    // had written it in a note. The sanitiser drops these on the way into the
    // database — see `note-html.ts` — so this is the second lock on a door that
    // should already be shut, which is the right number of locks for the path
    // between stored text and a model's instructions.
    .replace(/<\s*(script|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, " ")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(?:p|div|li|ul|ol|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&[a-z#0-9]+;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * The text somebody actually typed onto a canvas.
 *
 * A scene is Excalidraw's to describe and this reads exactly two things out of
 * it: the text elements, and the names of the frames they sit in. That is not
 * laziness about the rest — a rectangle at (240, 118) is not something a model
 * can say anything useful about, whereas the words written inside it are the
 * whole content of most study boards.
 *
 * Everything is guarded to the point of paranoia because `snapshot` is a `Json`
 * column with no schema behind it: it was written by whatever version of
 * Excalidraw the user's browser had, and a board saved a year ago is as valid
 * as one saved today.
 */
export function boardText(snapshot: unknown): { text: string; elements: number } {
  if (typeof snapshot !== "object" || snapshot === null) {
    return { text: "", elements: 0 };
  }

  const { elements } = snapshot as { elements?: unknown };
  if (!Array.isArray(elements)) return { text: "", elements: 0 };

  const lines: string[] = [];
  // Counted here rather than taken from `elements.length`, and the difference
  // is not pedantry: Excalidraw keeps deleted elements in the scene so that
  // undo can bring them back, so the raw length of a board somebody has drawn
  // on and cleared is a large number describing an empty canvas.
  let drawn = 0;

  for (const element of elements) {
    if (typeof element !== "object" || element === null) continue;
    const { type, text, name, isDeleted } = element as Record<string, unknown>;

    if (isDeleted === true) continue;
    drawn += 1;

    if (type === "text" && typeof text === "string" && text.trim()) {
      lines.push(text.trim());
    } else if (type === "frame" && typeof name === "string" && name.trim()) {
      lines.push(`[${name.trim()}]`);
    }
  }

  return { text: lines.join("\n"), elements: drawn };
}

/** A `@db.Date` column as the day it says it is. See `todo-dates.ts`. */
function toDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Cuts a body down without cutting a word in half. */
function clamp(text: string, limit: number): string {
  if (text.length <= limit) return text;

  const cut = text.slice(0, limit);
  const space = cut.lastIndexOf(" ");
  return `${(space > limit * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** The first line of a note is its name — the same rule the cards use. */
function noteTitleAndBody(content: string): { title: string; body: string } {
  const text = htmlToText(content);
  const newline = text.indexOf("\n");

  if (newline === -1) return { title: text.trim(), body: "" };
  return {
    title: text.slice(0, newline).trim(),
    body: text.slice(newline + 1).trim(),
  };
}

/**
 * The scope every query here shares.
 *
 * `documentId: undefined` is not the same as `documentId: null` and the
 * difference is the whole feature: undefined leaves the column unconstrained,
 * so a universal chat sees a document's notes *and* the loose ones, while null
 * would restrict it to only the loose ones. Written out once, here, because
 * getting it wrong in one of eight places would silently hide half the
 * user's work.
 */
interface WorkspaceScope {
  userId: string;
  /** Narrows to one document. Absent or null reads everything. */
  documentId?: string | null;
}

function documentFilter(documentId?: string | null) {
  return documentId ? { documentId } : {};
}

/** Every count in one round trip, so a prompt costs four queries and not eight. */
export async function countWorkspace({
  userId,
  documentId,
}: WorkspaceScope): Promise<WorkspaceCounts> {
  const where = { userId, ...documentFilter(documentId) };

  const [boards, notes, annotations, todos] = await Promise.all([
    prisma.board.count({ where }),
    prisma.stickyNote.count({ where }),
    // Annotations are always about a document, so an unscoped read is every
    // annotation the user has written rather than a filter that does nothing.
    prisma.documentAnnotation.count({ where }),
    prisma.todo.count({ where }),
  ]);

  return { boards, notes, annotations, todos };
}

async function readBoards(
  { userId, documentId }: WorkspaceScope,
  take: number,
  textLimit: number,
): Promise<WorkspaceItem[]> {
  const rows = await prisma.board.findMany({
    where: { userId, ...documentFilter(documentId) },
    select: {
      id: true,
      name: true,
      documentId: true,
      snapshot: true,
      updatedAt: true,
      document: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take,
  });

  return rows.map((row) => {
    const { text, elements } = boardText(row.snapshot);
    return {
      kind: "boards" as const,
      id: row.id,
      documentId: row.documentId,
      document: row.document?.name ?? null,
      title: row.name,
      text: clamp(text, textLimit),
      elements,
      updated: toDayKey(row.updatedAt),
    };
  });
}

async function readNotes(
  { userId, documentId }: WorkspaceScope,
  take: number,
  textLimit: number,
): Promise<WorkspaceItem[]> {
  const rows = await prisma.stickyNote.findMany({
    where: { userId, ...documentFilter(documentId) },
    select: {
      id: true,
      content: true,
      documentId: true,
      createdAt: true,
      updatedAt: true,
      document: { select: { name: true } },
    },
    // Newest first, as the wall reads them.
    orderBy: { createdAt: "desc" },
    take,
  });

  return rows.map((row) => {
    const { title, body } = noteTitleAndBody(row.content);
    return {
      kind: "notes" as const,
      id: row.id,
      documentId: row.documentId,
      document: row.document?.name ?? null,
      title: title || "Untitled note",
      text: clamp(body, textLimit),
      updated: toDayKey(row.updatedAt),
    };
  });
}

async function readAnnotations(
  { userId, documentId }: WorkspaceScope,
  take: number,
  textLimit: number,
): Promise<WorkspaceItem[]> {
  const rows = await prisma.documentAnnotation.findMany({
    where: { userId, ...documentFilter(documentId) },
    select: {
      id: true,
      documentId: true,
      pageNumber: true,
      quote: true,
      content: true,
      updatedAt: true,
      document: { select: { name: true } },
    },
    /*
      Page order within a document, recency across the drive.

      Reading one document's annotations is reading them in the order they were
      written *onto the page*, which is the order a person would find them; a
      cross-document read has no such order, and the useful few are the ones
      most recently touched.
    */
    orderBy: documentId
      ? [{ pageNumber: "asc" }, { y: "asc" }]
      : [{ updatedAt: "desc" }],
    take,
  });

  return rows.map((row) => ({
    kind: "annotations" as const,
    id: row.id,
    documentId: row.documentId,
    document: row.document.name,
    title: `Page ${row.pageNumber}`,
    text: clamp(htmlToText(row.content), textLimit),
    page: row.pageNumber,
    quote: clamp(row.quote, textLimit),
    updated: toDayKey(row.updatedAt),
  }));
}

async function readTodos(
  { userId, documentId }: WorkspaceScope,
  take: number,
): Promise<WorkspaceItem[]> {
  const rows = await prisma.todo.findMany({
    where: { userId, ...documentFilter(documentId) },
    select: {
      id: true,
      title: true,
      documentId: true,
      dueDate: true,
      priority: true,
      completed: true,
      updatedAt: true,
      document: { select: { name: true } },
    },
    /*
      Unfinished first, then by the day they are due.

      Not the order the todo page draws — that one is by day, and a day is what
      the page is made of. What a chat is asked is "what do I still have to
      do", and an answer that opened with last month's ticked tasks would be
      answering a question nobody asks.
    */
    orderBy: [{ completed: "asc" }, { dueDate: "asc" }, { position: "asc" }],
    take,
  });

  return rows.map((row) => ({
    kind: "todos" as const,
    id: row.id,
    documentId: row.documentId,
    document: row.document?.name ?? null,
    title: row.title,
    text: "",
    due: toDayKey(row.dueDate),
    priority: row.priority,
    done: row.completed,
    updated: toDayKey(row.updatedAt),
  }));
}

/**
 * What a chat is told about the user's own work before anyone says anything.
 *
 * Capped hard, and that is the point: the counts are exact, the items are the
 * most recent handful of each kind, and the tool below is how the model gets at
 * the rest. Inlining everything would work beautifully for the account this was
 * written against and fall over on the one with four hundred annotations —
 * which is the same argument `tools.ts` makes for not inlining document pages,
 * and it is worth making the same way twice rather than learning it twice.
 */
export async function readWorkspaceSnapshot(
  scope: WorkspaceScope,
): Promise<WorkspaceSnapshot> {
  const counts = await countWorkspace(scope);

  if (isWorkspaceEmpty(counts)) return { counts, items: [] };

  const [boards, notes, annotations, todos] = await Promise.all([
    counts.boards > 0
      ? readBoards(scope, SNAPSHOT_PER_KIND, SNAPSHOT_TEXT)
      : [],
    counts.notes > 0 ? readNotes(scope, SNAPSHOT_PER_KIND, SNAPSHOT_TEXT) : [],
    counts.annotations > 0
      ? readAnnotations(scope, SNAPSHOT_PER_KIND, SNAPSHOT_TEXT)
      : [],
    counts.todos > 0 ? readTodos(scope, SNAPSHOT_PER_KIND) : [],
  ]);

  return { counts, items: [...notes, ...annotations, ...todos, ...boards] };
}

/**
 * The whole of one kind, or a search across several — what the tool calls.
 *
 * `query` is a `contains` and not the full-text search the documents get. The
 * corpus is different in kind: a user's notes are a few hundred short strings,
 * where a substring match over an indexed column is both adequate and exact,
 * and there is no `searchVector` on these tables to use instead. Adding one
 * would mean a migration and a trigger per table to serve a corpus that fits in
 * memory.
 */
export async function readWorkspaceItems({
  userId,
  documentId,
  kinds,
  query,
  limit = DEFAULT_TOOL_LIMIT,
}: WorkspaceScope & {
  kinds?: readonly WorkspaceKind[] | null;
  query?: string | null;
  limit?: number;
}): Promise<WorkspaceItem[]> {
  const take = Math.min(Math.max(1, Math.trunc(limit)), MAX_TOOL_LIMIT);
  const wanted = new Set<WorkspaceKind>(
    kinds && kinds.length > 0 ? kinds : WORKSPACE_KINDS,
  );

  const scope = { userId, documentId };
  const search = query?.trim() ? query.trim() : null;

  /*
    Over-fetched, then filtered, and only when there is a query.

    A note's words live in HTML, so `content contains "osmosis"` misses a note
    whose osmosis is split across a `<b>` — and a board's words are inside a
    JSON blob no `WHERE` clause can reach into. Both are only findable after the
    text has been flattened, which happens in this process. Taking a wider slice
    and filtering it here is what makes the search honest; the multiplier is
    small because the alternative — reading every row — is the thing this is
    trying not to do.
  */
  const fetchTake = search ? Math.min(take * 8, 200) : take;

  const [boards, notes, annotations, todos] = await Promise.all([
    wanted.has("boards") ? readBoards(scope, fetchTake, TOOL_TEXT) : [],
    wanted.has("notes") ? readNotes(scope, fetchTake, TOOL_TEXT) : [],
    wanted.has("annotations")
      ? readAnnotations(scope, fetchTake, TOOL_TEXT)
      : [],
    wanted.has("todos") ? readTodos(scope, fetchTake) : [],
  ]);

  const items = [...notes, ...annotations, ...todos, ...boards];
  if (!search) return items.slice(0, take);

  const needle = search.toLowerCase();
  return items
    .filter((item) =>
      [item.title, item.text, item.quote ?? ""].some((field) =>
        field.toLowerCase().includes(needle),
      ),
    )
    .slice(0, take);
}
