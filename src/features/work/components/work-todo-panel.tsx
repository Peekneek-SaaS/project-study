"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";

import { TodoDaySection } from "@/features/todo/components/todo-day-section";
import { useTodayKey } from "@/features/todo/hooks/use-today-key";
import { useTodoClock } from "@/features/todo/hooks/use-todo-clock";
import { DAY_ATTRIBUTE } from "@/features/todo/hooks/use-todo-day-navigation";
import { groupTodosByDay } from "@/features/todo/lib/group-todos-by-day";
import { useTRPC } from "@/trpc/client";

/**
 * The tasks written against one document.
 *
 * The todo page in a panel, and deliberately the same page: the same day
 * sections in the same order, future first, with the same headings, counts,
 * menus, composer, rows and timers. Nothing here is a second implementation of
 * a task — this file only supplies the list and the scroller.
 *
 * List only, though. The grid is a fortnight of columns that wants the width of
 * a screen, and this is a panel that is often dragged down to three hundred
 * pixels; there is nothing to switch between, so there is no switch.
 *
 * These tasks are *not* private to this panel. A task is due on a day, and a
 * planner that hid the ones filed against a document would be lying about that
 * day — so each also appears in its day on the todo page, badged with this
 * document's name. That is the one way tasks differ from notes, and the schema
 * says why.
 *
 * One clock for the panel, started only when something here is counting and
 * handed down to every row — the same arrangement as the page, and for the same
 * reason: a timer per row would be a dozen intervals waking at slightly
 * different moments and disagreeing on screen.
 */
export function WorkTodoPanel({ documentId }: { documentId: string }) {
  const trpc = useTRPC();

  const { data: todos } = useSuspenseQuery(
    trpc.todo.listForDocument.queryOptions({ documentId }),
  );

  // The day everything here is measured against, and what re-renders the panel
  // at midnight so "Today" does not go on meaning yesterday.
  const today = useTodayKey();

  const hasRunningTimer = todos.some(
    (todo) => todo.timerStartedAt !== null && !todo.completed,
  );
  const now = useTodoClock(hasRunningTimer);

  const groups = useMemo(() => groupTodosByDay(todos, today), [todos, today]);

  /**
   * Opens on today, as the page does.
   *
   * Its own few lines rather than `useTodoDayNavigation`, which belongs to the
   * page: that hook also consumes the `?date=` parameter and rewrites the URL,
   * and a panel on a work page has no business doing either. What is left is
   * the part that matters here — the days run future-first, so the top of this
   * scroller is a fortnight away and landing there would hide today.
   *
   * Scoped to this panel's own scroller, because two lists on one page would
   * otherwise both answer to a bare `document.querySelector`.
   */
  const scroller = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const section = scroller.current?.querySelector(
      `[${DAY_ATTRIBUTE}="${today}"]`,
    );
    section?.scrollIntoView({ behavior: "instant", block: "start" });
  }, [today]);

  return (
    <div
      ref={scroller}
      // The day sections offset their scroll target by the page's sticky bars,
      // which do not exist in here — so the variables are declared as nothing
      // rather than left undefined, which would throw the whole `calc` away and
      // take the 1rem of breathing room with it.
      className="@container min-h-0 flex-1 overflow-y-auto px-3 py-3 [--drive-sticky-top:0rem] [--drive-title-h:0rem] [--drive-toolbar-h:0rem] h-full"
    >
      <div className="flex flex-col gap-8">
        {groups.map((group) => (
          <TodoDaySection
            key={group.key}
            group={group}
            today={today}
            now={now}
            variant="list"
            // What ties every write made here to this document's list rather
            // than to the page's, keeps "Delete all" from reaching past this
            // document, and stops every row repeating the document's name.
            documentId={documentId}
          />
        ))}
      </div>
    </div>
  );
}
