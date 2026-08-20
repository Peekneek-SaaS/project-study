"use client";

import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTRPC } from "@/trpc/client";
import { cn } from "@/lib/utils";

/**
 * Which documents' tasks the page is showing.
 *
 * A menu of tick boxes rather than the toolbar's usual `Select`, because this
 * is the one filter here that takes more than one answer: "what do these two
 * papers need from me" is a question people actually have, and a single-choice
 * control cannot ask it.
 *
 * The options are the documents something is filed under, not every file in the
 * drive — see the `documents` procedure. A menu of names that narrow the page to
 * nothing is a menu that wastes the click it took to open.
 *
 * Fetched with the toolbar rather than on opening the menu, even though most
 * visits never touch it: the trigger has to be able to *name* the document a
 * page arrived filtered by, and a list held back until the menu opens would
 * have it saying "1 file" about a link somebody followed. It is one row per
 * document that has ever had a task.
 */
export function TodoDocumentFilter({
  value,
  onChange,
}: {
  /** The chosen ids, or null when the filter is off. */
  value: string[] | null;
  onChange: (documents: string[] | null) => void;
}) {
  const trpc = useTRPC();
  const { data: documents } = useQuery(trpc.todo.documents.queryOptions());

  const selected = value ?? [];
  const isFiltering = selected.length > 0;

  /**
   * Ticking is adding and unticking is removing — and the last one removed
   * turns the filter off rather than leaving an empty list behind, which would
   * ask the page for tasks belonging to none of your documents.
   */
  const toggle = (documentId: string) => {
    const next = selected.includes(documentId)
      ? selected.filter((id) => id !== documentId)
      : [...selected, documentId];

    onChange(next.length > 0 ? next : null);
  };

  /** What the trigger says, so the toolbar reports the filter without opening it. */
  const label =
    selected.length === 0
      ? "File"
      : selected.length === 1
        ? (documents?.find((document) => document.id === selected[0])?.name ??
          "1 file")
        : `${selected.length} files`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          // Lit the same way the other filters are when they are carrying a
          // value: it is the reason the page is short.
          className={cn(
            "h-8 max-w-44 justify-start gap-1.5 font-normal dark:border-muted hover:border-primary",
            isFiltering && "border-primary/40 bg-primary/5 text-foreground",
          )}
        >
          <FileText className="size-3.5 shrink-0 fill-orange-400 stroke-orange-200" />
          <span className="truncate">{label}</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="max-h-72 w-56 overflow-y-auto"
      >
        {documents && documents.length > 0 ? (
          <>
            {documents.map((document) => (
              <DropdownMenuCheckboxItem
                key={document.id}
                checked={selected.includes(document.id)}
                // Kept open on a tick: choosing two documents is the whole
                // point of a filter that takes a list, and a menu that closed
                // after each one would have to be reopened for the second.
                onSelect={(event) => event.preventDefault()}
                onCheckedChange={() => toggle(document.id)}
              >
                <span className="truncate">{document.name}</span>
              </DropdownMenuCheckboxItem>
            ))}

            {/* Only offered once there is something to undo. */}
            {isFiltering && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => onChange(null)}>
                  Any file
                </DropdownMenuItem>
              </>
            )}
          </>
        ) : (
          <DropdownMenuItem disabled>
            {documents ? "No tasks are filed under a document" : "Loading…"}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
