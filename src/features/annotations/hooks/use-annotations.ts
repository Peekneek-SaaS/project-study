"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { AnchorRect } from "@/features/annotations/lib/anchor";
import type { Annotation } from "@/features/annotations/types";
import type {
  NoteAppearancePatch,
  NoteColor,
} from "@/features/sticky-notes/lib/note-appearance";
import { useTRPC } from "@/trpc/client";

/** Long enough to cover a sentence, short enough that a closed tab keeps it. */
const CONTENT_DEBOUNCE_MS = 800;

/**
 * The two keys every cache write in this file goes through.
 *
 * They are deliberately different shapes, and getting that wrong is what made a
 * new annotation invisible until the page was reloaded.
 *
 * `listKey` is the *exact* key the three readers render from — the viewer's
 * marker layer, the notes tab, and the section inside it all mount the same
 * query with the same input, so a write aimed here reaches every one of them on
 * the spot. An optimistic write has to land on this and nothing else: aimed at
 * a filter instead it can miss the entry actually on screen, and the change
 * only shows up when something else happens to refetch.
 *
 * `listFilter` carries no input at all, which is what makes it broad: it
 * matches every variant of the procedure rather than one document's. That is
 * what invalidation wants, and it is the same split the todo mutations use —
 * exact key to paint, broad filter to reconcile.
 */
function useAnnotationKeys(documentId: string) {
  const trpc = useTRPC();

  return useMemo(
    () => ({
      listKey: trpc.annotation.listForDocument.queryKey({ documentId }),
      listFilter: trpc.annotation.listForDocument.queryFilter(),
    }),
    [trpc, documentId],
  );
}

/**
 * Every annotation on the open document, and the way to add one.
 *
 * Fetched whole rather than page by page — see `listForDocument` on the router.
 * The consequence worth knowing here is that a page scrolling into view already
 * has its markers rather than growing them a request later.
 */
export function useDocumentAnnotations(documentId: string | null) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Never read while disabled; `enabled` is what makes the empty string safe.
  const scoped = documentId ?? "";
  const { data } = useQuery({
    ...trpc.annotation.listForDocument.queryOptions({ documentId: scoped }),
    enabled: Boolean(documentId),
  });

  const { listKey, listFilter } = useAnnotationKeys(scoped);

  const { mutateAsync: createMutation, isPending: isCreating } = useMutation(
    trpc.annotation.create.mutationOptions(),
  );

  const createAnnotation = useCallback(
    async (input: NewAnnotationInput) => {
      /*
        Typed on the way in, rather than inferred from the mutation.

        The row comes back with its Json column typed as Prisma's recursive
        `JsonValue`, and spreading that into an `Annotation[]` sends TypeScript
        expanding it until it gives up. Naming the target widens `rects` to
        `unknown` — which is what `Annotation` says it is, and what every reader
        of it already assumes.
      */
      const created: Annotation = await createMutation(input);

      /*
        Written into the list before anything is refetched.

        This is what "the dot appears when I press Save" is made of. Left to
        invalidation alone the marker waits on a round trip that has to finish
        before anything is painted — and if that invalidation misses the entry
        on screen, as an input-scoped filter can, it never appears at all until
        the page is reloaded. Appending the row the server just handed back
        needs no request and cannot miss.
      */
      queryClient.setQueryData<Annotation[]>(listKey, (rows) =>
        // Prepended, not appended: the list is newest-first, and a row added at
        // the wrong end would sit there until the refetch below quietly moved
        // it — which reads as the note jumping after you saved it.
        rows ? [created, ...rows] : [created],
      );

      // Then reconcile, broadly, in the background: the server decides the
      // order and may know about rows written in another tab.
      void queryClient.invalidateQueries(listFilter);

      return created;
    },
    [createMutation, queryClient, listKey, listFilter],
  );

  return {
    annotations: data ?? [],
    createAnnotation,
    isCreating,
  };
}

/** The annotations on one page, in the order they were written. */
export function annotationsOnPage(
  annotations: Annotation[],
  pageNumber: number,
): Annotation[] {
  return annotations.filter(
    (annotation) => annotation.pageNumber === pageNumber,
  );
}

/** What `create` needs beyond the appearance defaults. */
export interface NewAnnotationInput extends AnchorRect {
  documentId: string;
  pageNumber: number;
  quote: string;
  content: string;
  color?: NoteColor;
  /** One box per line — see `rangeToAnchors`. */
  rects: AnchorRect[];
}

/**
 * Writing one annotation back, in the two rhythms it changes in.
 *
 * Lifted from `useNoteMutations`, including the reasoning: typing is continuous
 * and cheap to lose a moment of, so it is debounced and never invalidates — the
 * editor already holds the newest text and a refetch mid-sentence would invite
 * the server's older copy to argue with it. Appearance is one deliberate click,
 * so it is written at once and painted optimistically, because a colour that
 * waits for a round trip feels broken.
 */
export function useAnnotationMutations(
  annotationId: string,
  documentId: string,
) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { listKey, listFilter } = useAnnotationKeys(documentId);

  const { mutateAsync: updateMutation } = useMutation(
    trpc.annotation.update.mutationOptions(),
  );
  const { mutateAsync: removeMutation } = useMutation(
    trpc.annotation.remove.mutationOptions(),
  );

  const timer = useRef<number | null>(null);
  const pending = useRef<string | null>(null);

  // The mutate function is replaced on every render; the timeout below fires
  // long after the render that scheduled it, so it has to reach the current one
  // rather than the one it closed over.
  const updateRef = useRef(updateMutation);
  useEffect(() => {
    updateRef.current = updateMutation;
  });

  const flushContent = useCallback(async () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }

    const content = pending.current;
    if (content === null) return;
    pending.current = null;

    try {
      await updateRef.current({ id: annotationId, content });
    } catch {
      toast.error("That note could not be saved.");
    }
  }, [annotationId]);

  // A closing tab, a page turn, an unmount mid-sentence: whatever is still
  // waiting on the debounce goes now rather than being dropped.
  useEffect(() => {
    return () => {
      void flushContent();
    };
  }, [flushContent]);

  const setContent = useCallback(
    (content: string) => {
      pending.current = content;

      /*
        Painted into the list as it is typed, as well as being queued.

        Without this the note reads back as it was when the popover opened:
        every reader of the annotation — the card in the notes tab, the body in
        the marker's own popover — renders from the query, and the query does
        not hear about a keystroke that is still sitting on an 800ms timer. The
        write is local and costs nothing; the debounce is only about how often
        the *server* is told.
      */
      queryClient.setQueryData<Annotation[]>(listKey, (rows) =>
        rows?.map((row) =>
          row.id === annotationId ? { ...row, content } : row,
        ),
      );

      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        void flushContent();
      }, CONTENT_DEBOUNCE_MS);
    },
    [annotationId, flushContent, listKey, queryClient],
  );

  const setAppearance = useCallback(
    async (patch: NoteAppearancePatch) => {
      // Painted before the request, so the dot on the page changes colour under
      // the click rather than a round trip later.
      queryClient.setQueryData<Annotation[]>(listKey, (rows) =>
        rows?.map((row) =>
          row.id === annotationId ? { ...row, ...patch } : row,
        ),
      );

      try {
        await updateMutation({ id: annotationId, ...patch });
      } catch {
        toast.error("That change could not be saved.");
        void queryClient.invalidateQueries(listFilter);
      }
    },
    [annotationId, listFilter, listKey, queryClient, updateMutation],
  );

  const deleteAnnotation = useCallback(async () => {
    // Anything still on the debounce is for a row that is about to stop
    // existing. Dropped rather than flushed, or the update races the delete and
    // whichever loses reports an error the user cannot act on.
    if (timer.current !== null) window.clearTimeout(timer.current);
    pending.current = null;

    queryClient.setQueryData<Annotation[]>(listKey, (rows) =>
      rows?.filter((row) => row.id !== annotationId),
    );

    try {
      await removeMutation({ id: annotationId });
    } catch {
      toast.error("That note could not be deleted.");
      void queryClient.invalidateQueries(listFilter);
    }
  }, [annotationId, listFilter, listKey, queryClient, removeMutation]);

  return { setContent, flushContent, setAppearance, deleteAnnotation };
}
