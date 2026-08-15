"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  NOTE_TARGET_PARAM,
  STICKY_NOTES_PATH,
} from "@/features/sticky-notes/types";

/** Five pulses of 600ms — long enough to find, short enough not to nag. */
const FLASH_MS = 3000;

/**
 * Takes the reader to the note something else pointed them at.
 *
 * Called by the grid once its notes are on the page — which they are, since it
 * renders from a suspended query — so the element is there to scroll to by the
 * time this runs. Returns the id to ring, and clears the parameter behind
 * itself: a note arrived at is arrived at, and a refresh should not re-announce
 * it.
 */
export function useNoteTarget() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const targetId = searchParams.get(NOTE_TARGET_PARAM);

  const [flashingId, setFlashingId] = useState<string | null>(null);

  useEffect(() => {
    if (!targetId) return;

    // Deferred a frame so the scroll measures a laid-out page rather than one
    // mid-commit — and so the work runs in a callback, where reacting to
    // something outside React by setting state is what a callback is for.
    const frame = window.requestAnimationFrame(() => {
      const element = document.querySelector(`[data-note-id="${targetId}"]`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        setFlashingId(targetId);
      }

      // Cleared last, deliberately. Clearing it first would re-render with no
      // target, which would run this effect's cleanup and cancel the frame
      // before it ever fired. Dropped even when the note is missing — deleted,
      // say — so a stale id does not sit in the URL.
      router.replace(pathname || STICKY_NOTES_PATH, { scroll: false });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [pathname, router, targetId]);

  // Kept apart from the effect above so the countdown is not restarted by the
  // re-render that clearing the parameter causes.
  useEffect(() => {
    if (!flashingId) return;

    const timer = window.setTimeout(() => setFlashingId(null), FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [flashingId]);

  return flashingId;
}
