"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  isSafeNoteUrl,
  REQUIRED_LINK_PREFIX,
} from "@/features/sticky-notes/lib/note-html";

/**
 * Where the address for a link is typed.
 *
 * A dialog rather than an inline field, because the words being linked are in
 * the note and the address is not: asking for it in place would mean writing
 * the URL into the sentence and taking it out again, which is the Markdown
 * behaviour this replaced.
 *
 * It insists on `https://` — checked here, before anything is written, and
 * checked again by the sanitiser before anything is stored. Insisting is
 * friendlier than accepting: a link saved without a scheme resolves against
 * this app's own origin and quietly goes nowhere, and finding that out is a
 * click and a wrong page later.
 */
export function NoteLinkDialog({
  open,
  onOpenChange,
  /** The words the link will sit on, shown so it is clear what is being linked. */
  text,
  /** The address already on the selection, when one is being edited. */
  initialHref,
  onSubmit,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  text: string;
  initialHref: string | null;
  onSubmit: (href: string) => void;
  onRemove: () => void;
}) {
  const [href, setHref] = useState(initialHref ?? REQUIRED_LINK_PREFIX);
  const [touched, setTouched] = useState(false);

  /*
    Reset on each opening rather than on mount: the dialog outlives any one
    link, and the second one would otherwise open holding the first one's
    address.

    Adjusted during the render that changes it rather than in an effect — the
    pattern the day sections and the selection bars already use here. An effect
    would paint the previous link's address for a frame first, and React rightly
    warns about the cascading render it costs.
  */
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setHref(initialHref ?? REQUIRED_LINK_PREFIX);
      setTouched(false);
    }
  }

  const isValid = isSafeNoteUrl(href);
  // Only complain about a field somebody has actually left in a bad state. The
  // prefilled `https://` is not yet a mistake, it is a starting point.
  const showError = touched && !isValid;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-sm"
        // The note's own dialog is underneath this one. Without this, closing
        // with Escape or a click outside would be handled by both and shut the
        // note as well as the link.
        onEscapeKeyDown={(event) => event.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>{initialHref ? "Edit link" : "Add a link"}</DialogTitle>
          <DialogDescription>
            {text.trim() ? `“${text.trim()}” will open this address.` : null}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            setTouched(true);
            if (!isValid) return;
            onSubmit(href.trim());
          }}
          className="flex flex-col gap-3"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note-link-href" className="text-xs">
              Address
            </Label>
            <Input
              id="note-link-href"
              autoFocus
              value={href}
              onChange={(event) => setHref(event.target.value)}
              onBlur={() => setTouched(true)}
              placeholder={`${REQUIRED_LINK_PREFIX}example.com`}
              inputMode="url"
              aria-invalid={showError || undefined}
              aria-describedby="note-link-error"
            />
            {/* The space is held whether or not there is a message in it, so
                the buttons below do not jump as the address is typed. */}
            <p
              id="note-link-error"
              // `--danger` rather than `text-destructive`, which in this theme
              // is the pale wash a destructive surface is painted with — see
              // the token's own note in `globals.css`.
              style={{ color: "var(--danger)" }}
              className="min-h-4 text-xs"
            >
              {showError ? `Links must start with ${REQUIRED_LINK_PREFIX}` : ""}
            </p>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            {/* Only where there is a link to remove — on a first insertion this
                would be a button that undoes something that has not happened. */}
            {initialHref ? (
              <Button type="button" variant="ghost" onClick={onRemove}>
                Remove link
              </Button>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!isValid}>
                Save
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
