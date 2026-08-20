"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StickyNote } from "lucide-react";
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

  const { data: notes, isLoading } = useQuery(
    trpc.stickyNote.list.queryOptions(),
  );
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

      {!isLoading && (!notes || notes.length === 0) && (
        <CommandEmpty className="text-muted-foreground">
          You have no notes yet.
        </CommandEmpty>
      )}

      {notes && notes.length > 0 && (
        <>
          <CommandEmpty className="text-muted-foreground">
            No note matches that.
          </CommandEmpty>
          <CommandGroup heading={PASTE_TARGET_COPY.notes.heading}>
            {notes.map((note) => (
              <CommandItem
                key={note.id}
                // Matched on the whole note, shown by its first line — a note
                // is remembered by something written in it, which is rarely its
                // opening words. The same rule the search palette uses.
                value={`${noteDisplayTitle(note.content)} ${note.content} ${note.id}`}
                disabled={update.isPending}
                onSelect={() => void handlePick(note)}
              >
                <StickyNote className="fill-yellow-400 stroke-yellow-200" />
                <span className="truncate">
                  {noteDisplayTitle(note.content)}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </>
      )}
    </PasteSearchShell>
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

  const [day, setDay] = useState<DayKey | null>(null);

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

  if (day) {
    return (
      <TodoComposer
        day={day}
        // Cut to what the column takes. The composer's own field enforces the
        // same limit as you type, but a value put *into* it is not typed — so
        // without this a long excerpt would be rejected by the router after the
        // dialog had closed, naming a limit the user was never shown. Trimmed
        // here rather than on save, so what will be written is on screen.
        initialTitle={text.slice(0, MAX_TODO_TITLE)}
        // Backing out returns to the month rather than closing the dialog: the
        // selection is gone by now, so a dismissed picker cannot be reopened on
        // the same text, and "wrong day" should not cost the paste.
        onClose={() => setDay(null)}
        onCreated={() => {
          toast.success(`Task added for ${dayLabel(day)}`);
          onDone();
        }}
        className="m-3 rounded-xl border"
      />
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
