"use client";

import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTRPC } from "@/trpc/client";
import { cn } from "@/lib/utils";

/**
 * A select item cannot carry an empty value — Radix reserves it for "nothing
 * picked" — so the reset option travels under a name of its own, exactly as it
 * does in `MainSelectFilter`.
 */
const ANY = "__any__";

/**
 * Which document's tasks the page is showing.
 *
 * The same `Select` the rest of the toolbar uses — see `MainSelectFilter` — so
 * the three filters read as one row of controls rather than two kinds of thing.
 * The options are fetched here rather than listed in a constant, which is the
 * only reason this is its own component instead of a third `MainSelectFilter`.
 *
 * The options are the documents something is filed under, not every file in the
 * drive — see the `documents` procedure. A list of names that narrow the page to
 * nothing is a list that wastes the click it took to open.
 *
 * Fetched with the toolbar rather than on opening the select, even though most
 * visits never touch it: the trigger has to be able to *name* the document a
 * page arrived filtered by, and a list held back until the select opens would
 * have it showing a bare id for a link somebody followed.
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

  // The param is a list because the URL has always carried one; the control
  // picks one at a time, so the first id is the whole of the filter.
  const selected = value?.[0] ?? null;
  const hasDocuments = documents !== undefined && documents.length > 0;

  return (
    <Select
      // Radix shows the placeholder for `""` as well as `undefined`, and the
      // empty string keeps the select controlled where `undefined` would hand
      // it back to Radix the moment the filter is cleared.
      value={selected ?? ""}
      onValueChange={(next) => onChange(next === ANY ? null : [next])}
      // Nothing to choose from is nothing to open: no task is filed under a
      // document yet, or the list has not arrived.
      disabled={!hasDocuments}
    >
      <SelectTrigger
        // Lit the same way the other filters are when they are carrying a
        // value: it is the reason the page is short.
        className={cn(
          "h-8 max-w-44 dark:border-muted hover:border-primary",
          selected !== null && "border-primary/40 bg-primary/5 text-foreground",
        )}
      >
        <SelectValue placeholder="File" />
      </SelectTrigger>

      <SelectContent className="max-h-72">
        <SelectGroup>
          {documents?.map((document) => (
            <SelectItem value={document.id} key={document.id}>
              <FileText className="size-3.5 shrink-0 fill-orange-400 stroke-orange-200" />
              <span className="truncate">{document.name}</span>
            </SelectItem>
          ))}

          {/* Only offered once there is something to undo. */}
          {selected !== null && (
            <>
              <SelectSeparator />
              <SelectItem value={ANY}>Any file</SelectItem>
            </>
          )}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
