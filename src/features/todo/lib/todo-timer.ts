import type { Todo } from "@/features/todo/types";

/**
 * The durations offered when a todo is given a timer.
 *
 * "How long will this take" is the question being asked, so these are lengths
 * rather than times of day. The spread is coarse on purpose — a picker with a
 * minute's granularity invites an estimate more precise than anybody's estimate
 * actually is, and the timer can be edited later anyway.
 */
export const TIMER_OPTIONS = [
  { value: 5 * 60, label: "5 min" },
  { value: 10 * 60, label: "10 min" },
  { value: 15 * 60, label: "15 min" },
  { value: 25 * 60, label: "25 min" },
  { value: 30 * 60, label: "30 min" },
  { value: 45 * 60, label: "45 min" },
  { value: 60 * 60, label: "1 hour" },
  { value: 90 * 60, label: "1 hr 30 min" },
  { value: 120 * 60, label: "2 hours" },
] as const;

/** A day, in seconds. The ceiling the router validates a timer against. */
export const MAX_TIMER_SECONDS = 24 * 60 * 60;

/**
 * Where a todo's timer has got to.
 *
 * - `none` — no timer was ever set. Most todos.
 * - `idle` — a timer is set and stopped, whether or not it has been run before.
 * - `running` — counting down right now.
 * - `elapsed` — the countdown reached zero. Transient: the row that notices
 *   this is the row that ticks the todo off, so it exists for about a frame.
 */
export type TimerState = "none" | "idle" | "running" | "elapsed";

export interface TimerReading {
  state: TimerState;
  /** Seconds left, floored at zero. `0` when there is no timer at all. */
  remaining: number;
  /** The whole timer, for the ring's denominator. */
  total: number;
  /** How far through, `0`–`1`. What the progress ring is drawn from. */
  progress: number;
}

/**
 * A todo's timer, read at an instant.
 *
 * All of it is derived — `timerSeconds` minus what has been banked minus what
 * the current stretch has run — which is what makes the countdown survive a
 * reload, a second tab, and a laptop lid. Nothing anywhere holds "seconds
 * left"; two columns and the clock say it, and every reader arrives at the same
 * answer.
 *
 * `now` is a parameter rather than read inside, so the ticking hook can pass
 * the same instant to every row it renders and so this stays a pure function
 * that can be reasoned about without a clock.
 *
 * `null` means the clock has not started — the state every render is in on the
 * server and during hydration, since `Date.now()` there would differ between
 * the two passes and mismatch. A running timer reads as though its current
 * stretch has not begun yet, which is what the server rendered and what the
 * first client paint shows, and `useTodoClock` corrects it a tick later.
 */
export function readTimer(todo: Todo, now: number | null): TimerReading {
  const total = todo.timerSeconds ?? 0;

  if (!todo.timerSeconds) {
    return { state: "none", remaining: 0, total: 0, progress: 0 };
  }

  const running = todo.timerStartedAt !== null;

  // Only the *current* stretch is measured against the clock; everything before
  // it was banked into `timerElapsed` when it was stopped.
  const currentStretch =
    running && now !== null
      ? Math.max(0, (now - new Date(todo.timerStartedAt!).getTime()) / 1000)
      : 0;

  const spent = todo.timerElapsed + currentStretch;
  const remaining = Math.max(0, total - spent);

  return {
    state: remaining <= 0 ? "elapsed" : running ? "running" : "idle",
    // Ceiling rather than floor, so a timer shows "25:00" for the first moment
    // of its first second instead of flicking straight to "24:59".
    remaining: Math.ceil(remaining),
    total,
    progress: Math.min(1, spent / total),
  };
}

/**
 * A countdown, as a clock reads.
 *
 * `m:ss` under an hour and `h:mm:ss` over it — the leading unit is never padded
 * because a timer that says "05:00" reads as five minutes past something.
 */
export function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;

  const pad = (value: number) => String(value).padStart(2, "0");

  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(secs)}`
    : `${minutes}:${pad(secs)}`;
}

/**
 * A duration, as a person says it — "25 min", "1 hr 30 min".
 *
 * For the chips and menus, where the number is a *choice* being described
 * rather than a countdown being watched. `formatCountdown` is for the latter.
 */
export function formatDuration(seconds: number): string {
  const named = TIMER_OPTIONS.find((option) => option.value === seconds);
  if (named) return named.label;

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);

  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
}
