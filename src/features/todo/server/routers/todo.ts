import { TRPCError } from "@trpc/server";
import z from "zod";

import type { Prisma } from "@/generated/prisma/client";

import { DAY_KEY_PATTERN } from "@/features/todo/lib/todo-dates";
import { TODO_PRIORITY_VALUES } from "@/features/todo/lib/todo-priority";
import { MAX_TIMER_SECONDS } from "@/features/todo/lib/todo-timer";
import { MODIFIED_VALUES, modifiedRange } from "@/lib/list-filters";
import { prisma } from "@/lib/prisma";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

/** A todo's title. Long enough for a sentence, short enough to stay one line. */
const MAX_TITLE = 500;

const dayKey = z.string().regex(DAY_KEY_PATTERN, "Expected a yyyy-MM-dd date");

const timerSeconds = z.number().int().min(60).max(MAX_TIMER_SECONDS);

/**
 * The `dueDate` column, in and out.
 *
 * `@db.Date` has no time and no zone, and Prisma represents it as a `Date`
 * pinned to UTC midnight. So the conversion on *this* side of the wire is UTC
 * arithmetic, and the conversion on the client's side — `todo-dates.ts` — is
 * local arithmetic, because there the same string means "the day the reader is
 * looking at". Mixing the two up is the one bug this feature can have that
 * nobody notices until a user in another timezone files a todo a day early.
 */
const toColumn = (day: string) => new Date(`${day}T00:00:00.000Z`);
const fromColumn = (date: Date) => date.toISOString().slice(0, 10);

const todoFields = {
  id: true,
  title: true,
  documentId: true,
  /**
   * The document a task was written against, for the chip on its row.
   *
   * The name rather than the id alone, because the chip has to say something a
   * person recognises — and a second request per row to find out what a task is
   * about would be the todo page's most expensive habit. Two columns through a
   * relation Prisma joins in the same statement.
   */
  document: { select: { id: true, name: true } },
  dueDate: true,
  priority: true,
  completed: true,
  completedAt: true,
  timerSeconds: true,
  timerStartedAt: true,
  timerElapsed: true,
  position: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * A row exactly as `todoFields` selects it.
 *
 * Derived rather than written out, so adding a column to the selection above is
 * one edit instead of two — and so the two can never disagree. Restating it by
 * hand is how `priority` quietly became `string` and lost the enum the whole
 * client side types against.
 */
type TodoRow = Prisma.TodoGetPayload<{ select: typeof todoFields }>;

/**
 * A row as the client receives it.
 *
 * Every timestamp becomes a string here rather than being left as a `Date`.
 * There is no transformer on this tRPC instance, so `Date`s are serialised to
 * ISO strings by `JSON.stringify` regardless — declaring them as `Date` in the
 * procedure's type would hand the client a type that is wrong about what it
 * holds, and every consumer would have to re-normalise defensively. Converting
 * once, here, makes the inferred type the truth.
 */
function toClient(row: TodoRow) {
  return {
    ...row,
    dueDate: fromColumn(row.dueDate),
    completedAt: row.completedAt?.toISOString() ?? null,
    timerStartedAt: row.timerStartedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Confirms a todo is this user's, saying no more than "no" if it is not. */
async function assertOwned(id: string, userId: string) {
  const todo = await prisma.todo.findFirst({
    where: { id, userId },
    select: { id: true },
  });

  if (!todo) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "This task does not exist, or is not yours.",
    });
  }

  return todo;
}

/**
 * The same for the document a task is being filed against.
 *
 * Checked separately from the task itself, exactly as the notes router checks
 * it: a `documentId` arrives from the client, and without this a user could
 * hang their tasks off someone else's document. The row would still be theirs,
 * so no later ownership check would ever catch it.
 */
async function assertOwnsDocument(documentId: string, userId: string) {
  const document = await prisma.document.findFirst({
    where: { id: documentId, userId },
    select: { id: true },
  });

  if (!document) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "This document does not exist, or is not yours.",
    });
  }
}

/**
 * Ticks off every todo whose timer ran out while nobody was watching.
 *
 * "When the time finishes it completes the task" has to hold whether or not the
 * tab that started the timer is still open, and a browser that has been closed
 * for an hour cannot honour it. So the promise is kept here: every read of the
 * list settles the timers that have expired since the last one, and the client
 * only ever handles the case where it *is* watching — which it does live, on
 * the second, because a row that waited for a refetch to tick itself off would
 * sit at 0:00 looking broken.
 *
 * Written per row rather than with `updateMany` because `timerElapsed` has to
 * land on each todo's own `timerSeconds`, and `updateMany` cannot copy one
 * column into another. The set is tiny by construction — it is only the timers
 * this user has actually left running — so the transaction is a handful of
 * statements at most, and usually none.
 */
async function sweepElapsedTimers(userId: string) {
  const running = await prisma.todo.findMany({
    where: {
      userId,
      completed: false,
      timerStartedAt: { not: null },
      timerSeconds: { not: null },
    },
    select: {
      id: true,
      timerSeconds: true,
      timerStartedAt: true,
      timerElapsed: true,
    },
  });

  if (running.length === 0) return;

  const now = Date.now();

  const elapsed = running.filter((todo) => {
    const stretch = (now - todo.timerStartedAt!.getTime()) / 1000;
    return todo.timerElapsed + stretch >= todo.timerSeconds!;
  });

  if (elapsed.length === 0) return;

  await prisma.$transaction(
    elapsed.map((todo) =>
      prisma.todo.update({
        where: { id: todo.id },
        data: {
          completed: true,
          completedAt: new Date(),
          // Stopped and spent: the countdown is over, so the banked total is
          // the whole timer. Leaving `timerStartedAt` set would have the row
          // still counting down past zero.
          timerStartedAt: null,
          timerElapsed: todo.timerSeconds!,
        },
      }),
    ),
  );
}

export const TodoRouter = createTRPCRouter({
  /**
   * Every todo this user has, newest day first.
   *
   * The whole list rather than a window of days, because the page's window is a
   * question about the reader's clock — which day is "today" — and answering it
   * here would mean either trusting a timezone the request does not carry or
   * cutting off the days the client is about to ask for. A personal todo list
   * is small enough that this is the cheaper mistake; if one ever is not, the
   * fix is paging designed for it rather than a cutoff guessed at here.
   *
   * Ordered the way the day sections read: days descending, so the future is
   * above today, and within a day by hand-order ascending. `groupTodosByDay`
   * relies on neither — it groups by key — but arriving pre-sorted means each
   * day's rows are already in the order they render in.
   *
   * The "modified" filter narrows on `updatedAt` while the grouping stays on
   * `dueDate`, exactly as on the notes wall: asking for what you touched today
   * hands back what you touched, still filed under the day it is due.
   */
  list: protectedProcedure
    .input(
      z
        .object({
          priority: z.enum(TODO_PRIORITY_VALUES).nullable().default(null),
          modified: z.enum(MODIFIED_VALUES).nullable().default(null),
        })
        .default({ priority: null, modified: null }),
    )
    .query(async ({ ctx, input }) => {
      await sweepElapsedTimers(ctx.userId);

      const updatedAt = modifiedRange(input.modified);

      const rows = await prisma.todo.findMany({
        where: {
          userId: ctx.userId,
          ...(input.priority && { priority: input.priority }),
          ...(updatedAt && { updatedAt }),
        },
        orderBy: [{ dueDate: "desc" }, { position: "asc" }, { createdAt: "asc" }],
        select: todoFields,
      });

      return rows.map(toClient);
    }),

  /**
   * One document's tasks, for the tab on its work page.
   *
   * Ascending, unlike `list`: this panel is read forwards — what is due next,
   * then after that — where the page's descending order exists to put the
   * future above today for a reader scrolling up. A dozen tasks in a narrow
   * column do not need that, and would only read as backwards.
   *
   * Unfiltered, for the same reason the notes panel has no toolbar: the whole
   * list is what one document collects, and there is nothing here to narrow.
   *
   * The timer sweep runs here too. A task's timer must be able to finish while
   * the todo page is closed, and the work page is exactly where somebody sits
   * with one running.
   */
  listForDocument: protectedProcedure
    .input(z.object({ documentId: z.string() }))
    .query(async ({ ctx, input }) => {
      await sweepElapsedTimers(ctx.userId);

      const rows = await prisma.todo.findMany({
        where: { userId: ctx.userId, documentId: input.documentId },
        orderBy: [{ dueDate: "asc" }, { position: "asc" }, { createdAt: "asc" }],
        select: todoFields,
      });

      return rows.map(toClient);
    }),

  /**
   * How many todos sit on each day, for the dots in the header's calendar.
   *
   * A count per day rather than the todos themselves: the calendar only needs
   * to know which squares to mark, and shipping every title to draw a dot would
   * make the header's idle fetch the largest request on most pages.
   *
   * Unfiltered on purpose. The dot answers "is there anything here", and a
   * calendar that went dark because the todo page happened to be filtered to
   * "high priority" would be lying about the month.
   */
  calendar: protectedProcedure.query(async ({ ctx }) => {
    await sweepElapsedTimers(ctx.userId);

    const days = await prisma.todo.groupBy({
      by: ["dueDate", "completed"],
      where: { userId: ctx.userId },
      _count: { _all: true },
    });

    // Folded back into one row per day. Grouping by `completed` as well is what
    // lets a day report both numbers from a single pass — the dot cares about
    // what is outstanding, the tooltip about the whole day.
    const byDay = new Map<string, { date: string; total: number; pending: number }>();

    for (const day of days) {
      const date = fromColumn(day.dueDate);
      const entry = byDay.get(date) ?? { date, total: 0, pending: 0 };

      entry.total += day._count._all;
      if (!day.completed) entry.pending += day._count._all;

      byDay.set(date, entry);
    }

    return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
  }),

  /**
   * Adds a todo to a day.
   *
   * `position` is taken from the end of that day rather than defaulted, so a
   * new task lands under the ones already there instead of on top of them —
   * which is what "Add task", sitting at the bottom of the section, promises.
   *
   * `documentId` decides what the task is *about*, not where it shows: absent,
   * it stands on its own; present, it belongs to that document and appears both
   * on its work page and — badged — in its day on the todo page. That is the
   * one way tasks differ from notes, and the schema says why.
   *
   * The end of the day is measured across the whole day rather than within the
   * document, because that is the order the todo page renders: two documents'
   * tasks due tomorrow share one section, and positions counted per document
   * would collide there.
   */
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().trim().min(1).max(MAX_TITLE),
        dueDate: dayKey,
        priority: z.enum(TODO_PRIORITY_VALUES).optional(),
        timerSeconds: timerSeconds.nullish(),
        documentId: z.string().nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.documentId) {
        await assertOwnsDocument(input.documentId, ctx.userId);
      }

      const last = await prisma.todo.aggregate({
        where: { userId: ctx.userId, dueDate: toColumn(input.dueDate) },
        _max: { position: true },
      });

      const row = await prisma.todo.create({
        data: {
          userId: ctx.userId,
          documentId: input.documentId ?? null,
          title: input.title,
          dueDate: toColumn(input.dueDate),
          priority: input.priority ?? "NONE",
          timerSeconds: input.timerSeconds ?? null,
          position: (last._max.position ?? -1) + 1,
        },
        select: todoFields,
      });

      return toClient(row);
    }),

  /**
   * Changes anything about a todo: its title, its day, its priority, its timer.
   *
   * One procedure for all of them because they arrive the same way — a patch of
   * whatever the edit touched. Prisma skips `undefined`, so an unmentioned
   * column is left alone; `timerSeconds` is the one field that distinguishes
   * absent from `null`, because clearing a timer is a thing the user can ask
   * for and it has to be sayable.
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().trim().min(1).max(MAX_TITLE).optional(),
        dueDate: dayKey.optional(),
        priority: z.enum(TODO_PRIORITY_VALUES).optional(),
        timerSeconds: timerSeconds.nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, dueDate, timerSeconds: timer, ...patch } = input;
      await assertOwned(id, ctx.userId);

      const row = await prisma.todo.update({
        where: { id },
        data: {
          ...patch,
          ...(dueDate && { dueDate: toColumn(dueDate) }),
          // A timer that is changed is a timer that starts over. Keeping the
          // banked seconds would mean setting a fresh 25 minutes on a task that
          // already ran for 20 leaves five — which is not what "change the
          // timer" means to the person who asked for it.
          ...(timer !== undefined && {
            timerSeconds: timer,
            timerStartedAt: null,
            timerElapsed: 0,
          }),
        },
        select: todoFields,
      });

      return toClient(row);
    }),

  /**
   * Ticks a todo off, or puts it back.
   *
   * Completing stops the clock — a finished task should not still be counting —
   * and un-completing hands back the time that had been banked rather than
   * resetting it, so unticking something by accident does not cost the twenty
   * minutes it had already run.
   */
  setCompleted: protectedProcedure
    .input(z.object({ id: z.string(), completed: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await assertOwned(input.id, ctx.userId);

      const row = await prisma.todo.update({
        where: { id: input.id },
        data: {
          completed: input.completed,
          completedAt: input.completed ? new Date() : null,
          ...(input.completed && { timerStartedAt: null }),
        },
        select: todoFields,
      });

      return toClient(row);
    }),

  /**
   * Starts, pauses, or rewinds a todo's timer.
   *
   * Three verbs on one procedure because they are three writes to the same pair
   * of columns, and splitting them would mean three round trips' worth of
   * ownership checks to express one idea. `timerStartedAt` is the state: set is
   * running, null is not, and `timerElapsed` is what has been banked.
   *
   * Starting a finished task un-finishes it. Pressing play on something ticked
   * off is unambiguous about the intent, and the alternative — silently
   * refusing — leaves a button that does nothing.
   */
  setTimerRunning: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        action: z.enum(["start", "pause", "reset"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertOwned(input.id, ctx.userId);

      const current = await prisma.todo.findUniqueOrThrow({
        where: { id: input.id },
        select: { timerStartedAt: true, timerElapsed: true, timerSeconds: true },
      });

      if (!current.timerSeconds) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This task has no timer to run.",
        });
      }

      const data =
        input.action === "start"
          ? {
              timerStartedAt: new Date(),
              completed: false,
              completedAt: null,
            }
          : input.action === "pause"
            ? {
                timerStartedAt: null,
                // Banked on the way out. Reading the clock here rather than
                // trusting a number from the client is what keeps a paused
                // timer honest.
                timerElapsed: current.timerStartedAt
                  ? Math.min(
                      current.timerSeconds,
                      current.timerElapsed +
                        Math.round(
                          (Date.now() - current.timerStartedAt.getTime()) / 1000,
                        ),
                    )
                  : current.timerElapsed,
              }
            : { timerStartedAt: null, timerElapsed: 0 };

      // Starting an already-running timer would otherwise throw away the
      // stretch it is in the middle of by resetting its start.
      if (input.action === "start" && current.timerStartedAt) {
        const row = await prisma.todo.findUniqueOrThrow({
          where: { id: input.id },
          select: todoFields,
        });
        return toClient(row);
      }

      const row = await prisma.todo.update({
        where: { id: input.id },
        data,
        select: todoFields,
      });

      return toClient(row);
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertOwned(input.id, ctx.userId);
      await prisma.todo.delete({ where: { id: input.id } });
      return { id: input.id };
    }),

  /**
   * Clears out a day — either the whole thing, or just what is done.
   *
   * What the day heading's menu calls. Scoped by `userId` in the `where` rather
   * than checked first, so a day that is not the caller's matches nothing
   * instead of erroring, and it is one round trip either way.
   *
   * `documentId` narrows it to one document's tasks, which is what the same
   * menu means on a work page: "delete all" under a day there is about this
   * document's day, and without this it would quietly take the rest of the
   * user's Tuesday with it.
   */
  clearDay: protectedProcedure
    .input(
      z.object({
        dueDate: dayKey,
        completedOnly: z.boolean().default(true),
        documentId: z.string().nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { count } = await prisma.todo.deleteMany({
        where: {
          userId: ctx.userId,
          dueDate: toColumn(input.dueDate),
          ...(input.completedOnly && { completed: true }),
          ...(input.documentId && { documentId: input.documentId }),
        },
      });

      return { count };
    }),
});
