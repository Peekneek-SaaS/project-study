"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleSlash, FileText, StickyNote } from "lucide-react";
import { toast } from "sonner";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { Spinner } from "@/components/ui/spinner";
import { PASTE_TARGET_COPY } from "@/features/main/lib/paste-targets";
import { MAX_NOTE_CONTENT } from "@/features/sticky-notes/lib/note-appearance";
import { noteDisplayTitle } from "@/features/sticky-notes/lib/note-content";
import { TodoComposer } from "@/features/todo/components/todo-composer";
import {
  dayLabel,
  parseDayKey,
  toDayKey,
  todayKey,
  type DayKey,
} from "@/features/todo/lib/todo-dates";
import { MAX_TODO_TITLE } from "@/features/todo/lib/todo-title";
import {
  selectIsOpen,
  selectPasteTarget,
  useModalStore,
} from "@/lib/stores/modal-store";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";

/**
 * Puts a piece of selected text somewhere the user chooses.
 *
 * One shell — the dialog, the excerpt, the search box — with a body per kind
 * inside it. The shell is shared because every one of these opens on the same
 * question ("which one?"), and the bodies are separate because each answers to
 * a different router and writes in a different way. Adding a kind is a
 * component and a branch; nothing here has to grow a condition.
 *
 * The bodies are separate components rather than entries in a lookup table for
 * a concrete reason: each needs its own queries and mutations, and hooks chosen
 * from a record at render time would change identity when the kind changes,
 * which is exactly what the rules of hooks forbid. A branch that mounts one
 * component or another has no such problem.
 *
 * A body is not required to be a list, either. Answering "which one?" is only
 * the first half of some pastes — a task takes a day, a timer and a priority as
 * well as its words — so a body owns the whole dialog under the title and may
 * put a second step there. See `TodosPasteBody`.
 */

/** What every kind's body is handed. */
interface PasteBodyProps {
  text: string;
  /** Absent on a stage that does not search — see the todos body. */
  placeholder?: string;
  onDone: () => void;
}

/**
 * What is about to be pasted, above whatever is being asked about it.
 *
 * By the time the picker is open the selection has been cleared, so this line
 * is the only confirmation of *what* is in hand — and picking the wrong note is
 * much easier to undo than working out afterwards which stray sentence went
 * where. Shown by every stage that has not already put the text on screen in a
 * field of its own; where one has, repeating it would only say the same thing
 * twice.
 */
function PasteExcerpt({ text }: { text: string }) {
  return (
    <div className="border-b px-3 py-2">
      <p className="line-clamp-2 text-xs text-muted-foreground italic">
        “{text}”
      </p>
    </div>
  );
}

/** The dialog's contents while the question is "which one?". */
function PasteSearchShell({
  text,
  placeholder,
  children,
}: {
  text: string;
  placeholder?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <PasteExcerpt text={text} />

      <Command className="min-h-0 flex-1">
        <CommandInput placeholder={placeholder} />
        <CommandList className="max-h-none min-h-0 flex-1">
          {children}
        </CommandList>
      </Command>
    </>
  );
}

/** The spinner every body shows while its list is on its way. */
function PasteLoading() {
  return (
    <div className="flex items-center justify-center py-8">
      <Spinner />
    </div>
  );
}

/**
 * Appends to a note, rather than replacing it.
 *
 * A note is somewhere things accumulate, so pasting into one that already has
 * something in it has to add rather than overwrite — losing what was there in
 * order to keep a quotation would be the worst possible reading of the gesture.
 * A blank line between the two keeps them from running together.
 */
function appendToNote(existing: string, text: string) {
  const joined = existing.trim() ? `${existing.trim()}\n\n${text}` : text;
  // Trimmed to what the column will take. The alternative is a rejection after
  // the modal has closed, naming a limit the user was never shown.
  return joined.slice(0, MAX_NOTE_CONTENT);
}

function NotesPasteBody({ text, placeholder, onDone }: PasteBodyProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  /*
    Both kinds of note, because both are somewhere an excerpt can go.

    A note taken against a document is where most notes *about* a document
    already are — written while reading it — so a picker offering only the
    standalone wall was hiding the likelier destination. Two queries rather than
    one: each router entry keeps answering for its own rows, and neither the
    wall nor a work page is refetched because this dialog opened.
  */
  const { data: standalone, isLoading: isLoadingStandalone } = useQuery(
    trpc.stickyNote.list.queryOptions(),
  );
  const { data: inDocuments, isLoading: isLoadingInDocuments } = useQuery(
    trpc.stickyNote.listInDocuments.queryOptions(),
  );

  const isLoading = isLoadingStandalone || isLoadingInDocuments;
  const notes = standalone ?? [];
  const documentNotes = inDocuments ?? [];
  const isEmpty = notes.length === 0 && documentNotes.length === 0;

  const update = useMutation(trpc.stickyNote.update.mutationOptions());

  const handlePick = async (note: { id: string; content: string }) => {
    if (update.isPending) return;

    try {
      await update.mutateAsync({
        id: note.id,
        content: appendToNote(note.content, text),
      });
      await queryClient.invalidateQueries(trpc.stickyNote.pathFilter());
      toast.success(`Added to ${noteDisplayTitle(note.content)}`);
      onDone();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not write to that note",
      );
    }
  };

  return (
    <PasteSearchShell text={text} placeholder={placeholder}>
      {isLoading && <PasteLoading />}

      {!isLoading && isEmpty && (
        <CommandEmpty className="text-muted-foreground">
          You have no notes yet.
        </CommandEmpty>
      )}

      {!isEmpty && (
        <>
          <CommandEmpty className="text-muted-foreground">
            No note matches that.
          </CommandEmpty>

          {notes.length > 0 && (
            <CommandGroup heading={PASTE_TARGET_COPY.notes.heading}>
              {notes.map((note) => (
                <NotePasteItem
                  key={note.id}
                  note={note}
                  isBusy={update.isPending}
                  onPick={() => void handlePick(note)}
                />
              ))}
            </CommandGroup>
          )}

          {/*
            A second group rather than one flat list: which document a note
            belongs to is most of what tells two "Chapter 4" notes apart, and a
            heading says it once instead of on every row. The document's name
            still rides on each row as well — the groups collapse to nothing
            when the list is filtered, and a match on its own has to say where
            it lives.
          */}
          {documentNotes.length > 0 && (
            <CommandGroup heading="Notes on documents">
              {documentNotes.map((note) => (
                <NotePasteItem
                  key={note.id}
                  note={note}
                  document={note.document}
                  isBusy={update.isPending}
                  onPick={() => void handlePick(note)}
                />
              ))}
            </CommandGroup>
          )}
        </>
      )}
    </PasteSearchShell>
  );
}

/**
 * One note in the picker.
 *
 * Matched on the whole note and on its document's name, shown by its first line
 * — a note is remembered by something written in it, which is rarely its
 * opening words, and a note about a document is remembered by the document.
 * The same rule the search palette uses.
 */
function NotePasteItem({
  note,
  document,
  isBusy,
  onPick,
}: {
  note: { id: string; content: string };
  document?: { id: string; name: string };
  isBusy: boolean;
  onPick: () => void;
}) {
  return (
    <CommandItem
      value={`${noteDisplayTitle(note.content)} ${note.content} ${document?.name ?? ""} ${note.id}`}
      disabled={isBusy}
      onSelect={onPick}
    >
      <StickyNote className="fill-yellow-400 stroke-yellow-200" />
      <span className="truncate">{noteDisplayTitle(note.content)}</span>
      {document && (
        <span className="ml-auto flex min-w-0 shrink items-center gap-1 truncate text-xs text-muted-foreground">
          <FileText className="size-3 shrink-0 fill-orange-400 stroke-orange-200" />
          <span className="truncate">{document.name}</span>
        </span>
      )}
    </CommandItem>
  );
}

/**
 * Two steps: which day, then the task itself.
 *
 * Unlike a note, a task is not somewhere that already exists to be added to —
 * it is written now, and the first thing to decide about it is when it is due.
 * So the picker opens on a month rather than a list, and picking a day opens
 * the composer the todo page uses, with the excerpt already in its field and
 * the day already set. The rest of the answer — the timer, the priority, any
 * trimming of the words — is given there, in the chips it is given in
 * everywhere else, and Add is what writes.
 *
 * `TodoComposer` rather than a form of this modal's own, because it is the same
 * decision in both places — the same three chips, in the same order, through
 * the same optimistic create — and a second implementation would be one to keep
 * in step forever.
 *
 * The month is marked up exactly as the header's calendar is, from the same
 * counts (and usually the same cached response): days with work outstanding
 * carry a dot, days whose work is done carry a faint one. Which day is already
 * busy is most of what decides where a new task goes.
 */
function TodosPasteBody({ text, onDone }: PasteBodyProps) {
  const trpc = useTRPC();
  const { data: days } = useQuery(trpc.todo.calendar.queryOptions());

  /*
    Every document in the drive, not only the ones that already have tasks.

    `todo.documents` exists for the toolbar's *filter*, where offering a
    document with nothing filed under it would be an option that narrows the
    page to nothing. This is the opposite question — what could this task be
    about — and the first task against a document has to be possible to write.
  */
  const { data: driveItems } = useQuery(trpc.folder.getAllItems.queryOptions());

  const [day, setDay] = useState<DayKey | null>(null);
  /**
   * Which document the task is about — once that has been answered.
   *
   * Two pieces of state rather than one nullable id, because `null` is a real
   * answer here and not a missing one: a task standing on its own is the common
   * case, and "nothing in particular" has to be something somebody can *choose*
   * rather than the absence of a choice. `about` is what was picked; `asked` is
   * whether the question has been put yet.
   *
   * A document does not decide *where* the task shows — it appears in its day
   * either way — it decides what it is filed under. See the router's `create`.
   */
  const [about, setAbout] = useState<string | null>(null);
  const [asked, setAsked] = useState(false);

  const { pendingDays, doneDays } = useMemo(() => {
    const all = days ?? [];

    return {
      pendingDays: all
        .filter((entry) => entry.pending > 0)
        .map((entry) => parseDayKey(entry.date)),
      doneDays: all
        .filter((entry) => entry.pending === 0 && entry.total > 0)
        .map((entry) => parseDayKey(entry.date)),
    };
  }, [days]);

  const documents = driveItems?.documents ?? [];

  /*
    Which file, asked the way "which note" is asked.

    A searchable list rather than the dropdown this started as: a drive holds
    more files than a menu wants to scroll, and the way to find one here should
    be the way to find one everywhere else in this dialog — type a few letters
    of its name. Same shell, same input, same keyboard.

    Top of the list is "nothing in particular", so the common case is one Enter
    and the question never becomes a toll on the way to the composer. A drive
    with no files in it is not asked at all.
  */
  if (day && !asked && documents.length > 0) {
    return (
      <PasteSearchShell text={text} placeholder="Search your files…">
        <CommandEmpty className="text-muted-foreground">
          No file matches that.
        </CommandEmpty>

        <CommandGroup heading="What is this task about?">
          <CommandItem
            value="nothing in particular no file none"
            onSelect={() => {
              setAbout(null);
              setAsked(true);
            }}
          >
            <CircleSlash className="text-muted-foreground" />
            <span>Nothing in particular</span>
          </CommandItem>

          {documents.map((document) => (
            <CommandItem
              key={document.id}
              value={`${document.name} ${document.id}`}
              onSelect={() => {
                setAbout(document.id);
                setAsked(true);
              }}
            >
              <FileText className="fill-orange-400 stroke-orange-200" />
              <span className="truncate">{document.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </PasteSearchShell>
    );
  }

  if (day) {
    return (
      <div className="flex min-h-0 flex-col">
        <TodoComposer
          day={day}
          // Cut to what the column takes. The composer's own field enforces the
          // same limit as you type, but a value put *into* it is not typed — so
          // without this a long excerpt would be rejected by the router after the
          // dialog had closed, naming a limit the user was never shown. Trimmed
          // here rather than on save, so what will be written is on screen.
          initialTitle={text.slice(0, MAX_TODO_TITLE)}
          // Backing out unwinds one step rather than closing the dialog: the
          // selection is gone by now, so a dismissed picker cannot be reopened
          // on the same text, and a wrong turn should not cost the paste. From
          // the composer that is the file question; from there, the month.
          onClose={() => setAsked(false)}
          // What the task is about. The composer writes it through
          // `useTodoMutations`, which also decides which cached list the
          // optimistic row lands in — so the task appears on the document's own
          // tab straight away, not only on the todo page.
          documentId={about ?? undefined}
          onCreated={() => {
            toast.success(`Task added for ${dayLabel(day)}`);
            onDone();
          }}
          className="m-3 rounded-xl border"
        />
      </div>
    );
  }

  return (
    <>
      <PasteExcerpt text={text} />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Calendar
          mode="single"
          // Sized by the month rather than by the box around it. Filling the
          // dialog is wrong on a phone, where the dialog is the screen: the
          // cells are square, so a full-width row is a very tall calendar, and
          // the whole thing has to be scrolled to be read. A ceiling of its own
          // — centred under it — keeps the grid the same comfortable size at
          // every width, with the dialog free to be wider than it.
          className="mx-auto w-full max-w-[17.5rem] p-3 [--cell-size:--spacing(8)]"
          // Through `classNames` rather than the line above: `w-fit` lives in
          // the component's own root entry, and passing `w-full` alongside it
          // would leave two width utilities on one element, with the winner a
          // question about stylesheet order. Overriding the entry removes it.
          classNames={{ root: "w-full" }}
          // Nothing is selected yet, and nothing should look it: the month is a
          // question, and a day pre-filled with today would answer it for the
          // user in the one place where the answer is the whole point.
          selected={undefined}
          defaultMonth={parseDayKey(todayKey())}
          onSelect={(date) => date && setDay(toDayKey(date))}
          modifiers={{ hasPending: pendingDays, hasDone: doneDays }}
          components={{
            // The dot is drawn on the day *button* rather than through
            // `modifiersClassNames`, which lands on the cell around it — the
            // same reason the header's calendar does it this way.
            DayButton: ({ modifiers, className, ...props }) => (
              <CalendarDayButton
                modifiers={modifiers}
                className={cn(
                  (modifiers.hasPending || modifiers.hasDone) &&
                    "after:absolute after:bottom-1 after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:content-['']",
                  modifiers.hasPending && "after:bg-primary",
                  modifiers.hasDone && "after:bg-muted-foreground/40",
                  "data-[selected-single=true]:after:bg-primary-foreground",
                  className,
                )}
                {...props}
              />
            ),
          }}
          autoFocus
        />
      </div>
    </>
  );
}

export function PasteIntoModal() {
  const isOpen = useModalStore(selectIsOpen("paste-into"));
  const target = useModalStore(selectPasteTarget);
  const close = useModalStore((state) => state.close);

  // The payload is what the modal is *about*, so without one there is nothing
  // to draw — and reading `kind` off null would be the crash.
  if (!isOpen || !target) return null;

  const copy = PASTE_TARGET_COPY[target.kind];

  return (
    <CommandDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      title={copy.title}
      description={copy.description}
      className={cn(
        "top-1/4 flex flex-col gap-0",
        // A month is squares: width bought here is height as well, so the
        // dialog is cut to what the grid needs and no wider. A list is the
        // opposite and wants the room.
        //
        // The height has to clear the top offset as well as the viewport —
        // this sits a quarter of the way down and is not translated back up,
        // so anything past three quarters of the screen hangs off the bottom
        // of a short one.
        target.kind === "todos"
          ? "max-h-[70svh] sm:max-w-xs"
          : "max-h-[50svh] sm:max-w-xl",
      )}
    >
      {target.kind === "notes" && (
        <NotesPasteBody
          text={target.text}
          placeholder={copy.placeholder}
          onDone={close}
        />
      )}

      {target.kind === "todos" && (
        <TodosPasteBody
          // Remounted per paste, so a day picked in a previous open cannot be
          // the step this one starts on.
          key={target.text}
          text={target.text}
          onDone={close}
        />
      )}

      {/*
        The other kinds are named in `PASTE_TARGETS` and have their copy ready,
        but no body yet — each needs a way to *write* into its subject, and
        those are not alike: a board means adding a text element to an
        Excalidraw scene, a chat means composing a turn. Until one is built,
        opening the picker on it says so rather than showing an empty dialog
        that looks broken.
      */}
      {target.kind !== "notes" && target.kind !== "todos" && (
        <PasteSearchShell text={target.text} placeholder={copy.placeholder}>
          <CommandEmpty className="text-muted-foreground">
            Pasting into {copy.heading.toLowerCase()} is not available yet.
          </CommandEmpty>
        </PasteSearchShell>
      )}
    </CommandDialog>
  );
}
