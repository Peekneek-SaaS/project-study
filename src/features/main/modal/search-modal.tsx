"use client";

import { useQuery } from "@tanstack/react-query";
import {
  CornerDownLeft,
  FileText,
  Folder,
  LucideIcon,
  NotebookPen,
  SquareMousePointer,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { DriveStatusBadge } from "@/features/main/components/drive-status-badge";
import { boardPath } from "@/features/board/types";
import { useOpenDocument } from "@/features/main/hooks/use-open-document";
import { DRIVE_PATH } from "@/features/main/types";
import {
  searchBoardsOptions,
  searchItemsOptions,
  searchNotesOptions,
} from "@/features/main/hooks/use-search-items";
import { noteDisplayTitle } from "@/features/sticky-notes/lib/note-content";
import { stickyNotePath } from "@/features/sticky-notes/types";
import { useDriveStore } from "@/lib/stores/drive-store";
import { useSearchStore } from "@/lib/stores/search-store";
import { useTRPC } from "@/trpc/client";
import { cn } from "@/lib/utils";

interface SearchFolder {
  id: string;
  name: string;
  parentId: string | null;
}

interface kbdItemsProps {
  icon: LucideIcon | string;
  label: string;
}

const kbdItems: kbdItemsProps[] = [
  {
    icon: CornerDownLeft,
    label: "Open",
  },
  {
    icon: "esc",
    label: "Close",
  },
];

/**
 * A folder's ancestors, root first, including the folder itself.
 *
 * The whole tree is already on the client, so the trail is walked here rather
 * than asked for — and the `seen` guard keeps a malformed chain from spinning
 * forever, even though `folder.move` refuses to create one.
 */
function trailTo(folders: SearchFolder[], folderId: string | null) {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const trail: { id: string; name: string }[] = [];
  const seen = new Set<string>();

  let current = folderId ? byId.get(folderId) : undefined;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    trail.unshift({ id: current.id, name: current.name });
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return trail;
}

/** Where an item lives, for the second line of its row. */
const locationLabel = (trail: { name: string }[]) =>
  trail.length === 0
    ? "My files"
    : trail.map((crumb) => crumb.name).join(" / ");

/**
 * Search across the whole drive.
 *
 * Every folder and document is fetched once and filtered by cmdk in the
 * browser, so results appear as fast as they are typed. Selecting a folder
 * navigates to it; selecting a document opens it the same way the table does.
 */
export function SearchModal() {
  const isOpen = useSearchStore((state) => state.isOpen);
  const query = useSearchStore((state) => state.query);
  const setQuery = useSearchStore((state) => state.setQuery);
  const closeSearch = useSearchStore((state) => state.close);

  const router = useRouter();
  // Compared rather than pushed blindly: pushing the route you are already on
  // stacks a duplicate history entry, which costs the back button a press.
  const pathname = usePathname();
  const openFolder = useDriveStore((state) => state.openFolder);
  const goToCrumb = useDriveStore((state) => state.goToCrumb);
  const openDocument = useOpenDocument();

  const trpc = useTRPC();
  // Normally already answered: the header warms this entry on idle and again on
  // hover, so opening the palette usually reads straight from the cache. The
  // gate stays because a warm-up that has not landed yet — or was never run,
  // for anything that opens the palette without the header — should still fetch
  // on open rather than on every page that mounts this modal.
  const { data, isLoading: isLoadingItems } = useQuery({
    ...searchItemsOptions(trpc),
    enabled: isOpen,
  });
  const { data: boardData, isLoading: isLoadingBoards } = useQuery({
    ...searchBoardsOptions(trpc),
    enabled: isOpen,
  });
  const { data: noteData, isLoading: isLoadingNotes } = useQuery({
    ...searchNotesOptions(trpc),
    enabled: isOpen,
  });

  const isLoading = isLoadingItems || isLoadingBoards || isLoadingNotes;
  const folders = data?.folders ?? [];
  const documents = data?.documents ?? [];
  const boards = boardData ?? [];
  const notes = noteData ?? [];

  /**
   * Search can land on a folder several levels down, so the breadcrumb trail is
   * rebuilt from the root rather than appended to wherever the user happened to
   * be — otherwise the crumbs would describe a path that was never walked.
   */
  const handleSelectFolder = (folderId: string) => {
    const trail = trailTo(folders, folderId);
    closeSearch();
    goToCrumb(null);
    for (const crumb of trail) openFolder(crumb);

    // Moving the trail only rearranges the drive; it does not put it on screen.
    // Searched from a board or the notes page, everything above would happen
    // correctly and invisibly. The trail survives the navigation — it is a
    // client store, not route state — so it is set first and travels with us.
    if (pathname !== DRIVE_PATH) router.push(DRIVE_PATH);
  };

  const handleSelectDocument = (doc: (typeof documents)[number]) => {
    // Closed first: the preview is a modal of its own, and stacking the palette
    // over it traps focus in the one that is on its way out.
    closeSearch();
    openDocument(doc);
  };

  // A board is a page rather than something that opens over the drive, so this
  // one navigates instead of handing off to another modal.
  const handleSelectBoard = (boardId: string) => {
    closeSearch();
    router.push(boardPath(boardId));
  };

  // Notes share a page, so the id travels on the URL: the grid picks it up,
  // scrolls to that note and rings it — see `useNoteTarget`.
  const handleSelectNote = (noteId: string) => {
    closeSearch();
    router.push(stickyNotePath(noteId));
  };

  return (
    <CommandDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) closeSearch();
      }}
      title="Search"
      description="Search your folders and files"
      // Capped against the viewport rather than a pixel height, so a long
      // drive never pushes the palette off-screen. `flex` replaces the
      // dialog's own grid to let the list absorb the leftover space, and
      // `gap-0` keeps the shortcut bar flush against it.
      className="top-1/4 flex max-h-[50svh] flex-col gap-0 sm:max-w-xl"
    >
      {/*
        `CommandDialog` here drops its children straight into the dialog, so the
        cmdk root has to be supplied — without it the input has no context to
        report into and nothing filters.
      */}
      <Command className="min-h-0 flex-1">
        <CommandInput
          placeholder="Search folders and files…"
          value={query}
          onValueChange={setQuery}
        />
        {/* `max-h-none` drops the component's own 18rem cap; the height now
            comes from the dialog, and this is the only thing that scrolls. */}
        <CommandList className="max-h-none min-h-0 flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner />
            </div>
          ) : (
            <CommandEmpty className="text-muted-foreground">
              {query ? `Nothing matches “${query}”.` : "Nothing here yet."}
            </CommandEmpty>
          )}

          {folders.length > 0 && (
            <CommandGroup heading="Folders">
              {folders.map((folder) => (
                <CommandItem
                  key={folder.id}
                  value={`${folder.name} ${folder.id}`}
                  onSelect={() => handleSelectFolder(folder.id)}
                  className={cn("")}
                >
                  <Folder className="text-primary hover:text-primary" />
                  <span className="truncate">{folder.name}</span>
                  {/* <span className="ml-auto truncate pl-2 text-[0.625rem] text-muted-foreground ">
                    {locationLabel(trailTo(folders, folder.parentId))}
                  </span> */}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {documents.length > 0 && (
            <CommandGroup heading="Files">
              {documents.map((doc) => (
                <CommandItem
                  key={doc.id}
                  value={`${doc.name} ${doc.id}`}
                  // A document that is still uploading has nothing to open yet,
                  // exactly as in the row menu.
                  disabled={doc.status !== "READY"}
                  onSelect={() => handleSelectDocument(doc)}
                >
                  <FileText className="text-muted-foreground" />
                  <span className="truncate">{doc.name}</span>
                  {/* <div className="ml-auto flex shrink-0 items-center gap-2 pl-2">
                    <span className="truncate text-[0.625rem] text-muted-foreground">
                      {locationLabel(trailTo(folders, doc.folderId))}
                    </span>
                    <DriveStatusBadge status={doc.status} />
                  </div> */}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {boards.length > 0 && (
            <CommandGroup heading="Boards">
              {boards.map((board) => (
                <CommandItem
                  key={board.id}
                  value={`${board.name} ${board.id}`}
                  onSelect={() => handleSelectBoard(board.id)}
                >
                  <SquareMousePointer className="text-purple-500" />
                  <span className="truncate">{board.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {notes.length > 0 && (
            <CommandGroup heading="Notes">
              {notes.map((note) => (
                <CommandItem
                  key={note.id}
                  // The whole note is searchable, not just its name: a note is
                  // usually remembered by something written *in* it. The name
                  // is what gets shown, and cmdk matches on the rest silently.
                  value={`${noteDisplayTitle(note.content)} ${note.content} ${note.id}`}
                  onSelect={() => handleSelectNote(note.id)}
                >
                  <NotebookPen className="text-yellow-500" />
                  <span className="truncate">
                    {noteDisplayTitle(note.content)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>

      <div className="flex items-center justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
        {kbdItems.map(({ icon: Icon, label }) => (
          <div className="flex items-center gap-2" key={label}>
            {/* A string key is printed as-is ("esc"); anything else is a component. */}
            <Kbd>{typeof Icon === "string" ? Icon : <Icon />}</Kbd>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </CommandDialog>
  );
}
