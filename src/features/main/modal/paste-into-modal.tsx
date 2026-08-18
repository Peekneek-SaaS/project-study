"use client";

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
import { Spinner } from "@/components/ui/spinner";
import { PASTE_TARGET_COPY } from "@/features/main/lib/paste-targets";
import { MAX_NOTE_CONTENT } from "@/features/sticky-notes/lib/note-appearance";
import { noteDisplayTitle } from "@/features/sticky-notes/lib/note-content";
import {
  selectIsOpen,
  selectPasteTarget,
  useModalStore,
} from "@/lib/stores/modal-store";
import { useTRPC } from "@/trpc/client";

/**
 * Puts a piece of selected text somewhere the user chooses.
 *
 * One shell — the dialog, the search box, the empty state — with a list per
 * kind inside it. The shell is shared because every one of these is the same
 * question ("which one?"), and the lists are separate because each answers to a
 * different router and writes in a different way. Adding a kind is a component
 * and a branch; nothing here has to grow a condition.
 *
 * The lists are separate components rather than entries in a lookup table for a
 * concrete reason: each needs its own queries and mutations, and hooks chosen
 * from a record at render time would change identity when the kind changes,
 * which is exactly what the rules of hooks forbid. A branch that mounts one
 * component or another has no such problem.
 */

/** What every kind's list is handed. */
interface PasteListProps {
  text: string;
  onDone: () => void;
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

function NotesPasteList({ text, onDone }: PasteListProps) {
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    );
  }

  if (!notes || notes.length === 0) {
    return (
      <CommandEmpty className="text-muted-foreground">
        You have no notes yet.
      </CommandEmpty>
    );
  }

  return (
    <>
      <CommandEmpty className="text-muted-foreground">
        No note matches that.
      </CommandEmpty>
      <CommandGroup heading={PASTE_TARGET_COPY.notes.heading}>
        {notes.map((note) => (
          <CommandItem
            key={note.id}
            // Matched on the whole note, shown by its first line — a note is
            // remembered by something written in it, which is rarely its
            // opening words. The same rule the search palette uses.
            value={`${noteDisplayTitle(note.content)} ${note.content} ${note.id}`}
            disabled={update.isPending}
            onSelect={() => void handlePick(note)}
          >
            <StickyNote className="fill-yellow-400 stroke-yellow-200" />
            <span className="truncate">{noteDisplayTitle(note.content)}</span>
          </CommandItem>
        ))}
      </CommandGroup>
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
      className="top-1/4 flex max-h-[50svh] flex-col gap-0 sm:max-w-xl"
    >
      {/*
        The excerpt is worth showing. By the time this is open the selection has
        been cleared, so this line is the only confirmation of *what* is about
        to be pasted — and picking the wrong note is much easier to undo than
        working out afterwards which stray sentence went where.
      */}
      <div className="border-b px-3 py-2">
        <p className="line-clamp-2 text-xs text-muted-foreground italic">
          “{target.text}”
        </p>
      </div>

      <Command className="min-h-0 flex-1">
        <CommandInput placeholder={copy.placeholder} />
        <CommandList className="max-h-none min-h-0 flex-1">
          {target.kind === "notes" && (
            <NotesPasteList text={target.text} onDone={close} />
          )}

          {/*
            The other kinds are named in `PASTE_TARGETS` and have their copy
            ready, but no list yet — each needs a way to *write* into its
            subject, and those are not alike: a board means adding a text
            element to an Excalidraw scene, a chat means composing a turn.
            Until one is built, opening the picker on it says so rather than
            showing an empty dialog that looks broken.
          */}
          {target.kind !== "notes" && (
            <CommandEmpty className="text-muted-foreground">
              Pasting into {copy.heading.toLowerCase()} is not available yet.
            </CommandEmpty>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
