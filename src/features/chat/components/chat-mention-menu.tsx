"use client";

import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { useMemo } from "react";

import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Spinner } from "@/components/ui/spinner";
import { searchItemsOptions } from "@/features/main/hooks/use-search-items";
import { useTRPC } from "@/trpc/client";

/** A file as this menu needs it. */
export interface MentionFile {
  id: string;
  name: string;
}

/**
 * As many files as the menu will draw at once.
 *
 * Not a limit on what can be found — the query narrows the list before this
 * does, and a drive of any size is one more character away from a handful of
 * matches. It is a limit on how much of a large drive is built into the DOM
 * under a composer that may never be looked at.
 */
const MAX_RESULTS = 50;

/**
 * Every file the user could be referring to, narrowed by what they have typed
 * after the `@`.
 *
 * Reads the palette's query rather than one of its own: the same list of every
 * folder and document, already warmed on idle by the header and held fresh for
 * five minutes, so opening this costs nothing on a page that has been sat on
 * for a moment. Folders are dropped — a question is asked about a document, and
 * the model has no way to read a folder.
 *
 * Files that are still uploading or being processed are dropped too. The model
 * searches what has been read; offering a document it cannot open yet would be
 * offering a reference that silently does nothing.
 */
export function useMentionFiles(query: string, enabled: boolean) {
  const trpc = useTRPC();

  const { data, isLoading } = useQuery({
    ...searchItemsOptions(trpc),
    enabled,
  });

  const files = useMemo(() => {
    const documents = data?.documents ?? [];
    const needle = query.trim().toLowerCase();

    return (
      documents
        .filter((doc) => doc.status === "READY")
        .filter((doc) => !needle || doc.name.toLowerCase().includes(needle))
        // A name that *starts* with what was typed is almost always the one
        // meant, so those come first; everything else keeps the drive's order.
        .sort((a, b) => {
          if (!needle) return 0;
          const aStarts = a.name.toLowerCase().startsWith(needle);
          const bStarts = b.name.toLowerCase().startsWith(needle);
          return Number(bStarts) - Number(aStarts);
        })
        .slice(0, MAX_RESULTS)
        .map((doc) => ({ id: doc.id, name: doc.name }))
    );
  }, [data, query]);

  return { files, isLoading };
}

/**
 * The file list that opens over the composer when a question mentions one.
 *
 * Deliberately without a `CommandInput`. The search field *is* the textarea —
 * the user is mid-sentence, and taking focus away to a second box would break
 * the sentence and leave Enter meaning something different depending on where
 * the cursor had ended up. So focus never moves, the query comes from the token
 * being typed, and the arrow keys and Enter are handled by the composer that
 * still owns the keyboard.
 *
 * `shouldFilter={false}` follows from that: with no input for cmdk to read, it
 * has nothing to filter by, and the narrowing is done by `useMentionFiles`
 * before the list is handed over. What cmdk is left doing is what it is good
 * at — the roving highlight, the scroll-into-view, and the item semantics —
 * driven by `value`, which the composer moves.
 */
export function ChatMentionMenu({
  files,
  isLoading,
  activeId,
  onSelect,
  onHighlight,
}: {
  files: MentionFile[];
  isLoading: boolean;
  /** Which row the composer's arrow keys have landed on. */
  activeId: string | null;
  onSelect: (file: MentionFile) => void;
  /** Pointing at a row makes it the one Enter would take. */
  onHighlight: (file: MentionFile) => void;
}) {
  return (
    /*
      Above the box rather than below it. A composer usually sits at the bottom
      of the window — the landing page is the exception — so a menu hanging
      underneath would open off the bottom of the screen.

      Pinned to both edges of the composer so it lines up with the box it
      belongs to at every width, including the document panel's.
    */
    <div
      /*
        The textarea keeps focus through a click on this list.

        Without it the composer's `blur` fires on mouse-down, the menu unmounts
        before the mouse comes back up, and the click lands on nothing — the
        oldest bug there is in a menu that hangs off a text field. Preventing
        the default on mouse-down stops the browser moving focus at all, so the
        row's `select` runs and the caret never leaves the sentence.
      */
      onMouseDown={(event) => event.preventDefault()}
      className="absolute inset-x-0 bottom-full z-50 mb-2 overflow-hidden rounded-xl border bg-popover shadow-md"
    >
      <Command shouldFilter={false} value={activeId ?? ""} className="p-0">
        <CommandList className="max-h-64">
          {/*
            No empty state, because there is never an empty menu to put one in:
            the composer closes this the moment nothing matches. An `@` is not
            always a mention — an email address, a stray keystroke — and a box
            reading "no files" hanging over the composer while somebody types
            their address would be the picker insisting on itself.
          */}
          {isLoading && (
            <div className="flex items-center justify-center py-6">
              <Spinner />
            </div>
          )}

          {files.length > 0 && (
            <CommandGroup heading="Reference a file">
              {files.map((file) => (
                <CommandItem
                  key={file.id}
                  // The id, not the name: two documents may share a name, and
                  // cmdk decides which row is highlighted by this value.
                  value={file.id}
                  onSelect={() => onSelect(file)}
                  onPointerMove={() => onHighlight(file)}
                >
                  <FileText className="fill-orange-400 stroke-orange-200" />
                  <span className="truncate">{file.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </div>
  );
}
