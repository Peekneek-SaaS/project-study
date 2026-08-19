"use client";

import { Check } from "lucide-react";

import { priorityMeta, type TodoPriority } from "@/features/todo/lib/todo-priority";
import { cn } from "@/lib/utils";

/** The ring's radius in the 24-unit viewBox, and the circumference it implies. */
const RADIUS = 10;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * The dashed circle in front of every todo.
 *
 * One control doing two jobs, because they are the same job seen twice: it is
 * the tick box, and it is the face of the timer. A running todo fills its ring
 * clockwise as the countdown goes, so the thing that says "done" and the thing
 * that says "how far through" are the same shape in the same place — you learn
 * one and you can read the other.
 *
 * Drawn as an SVG rather than borrowed from the icon set because the arc has to
 * be a fraction of a circle, and an icon is all-or-nothing. The dashes are the
 * idle state's own stroke pattern, which is what lets the ring go solid the
 * moment it starts counting without anything swapping out underneath.
 *
 * Priority is the ring's colour. It rides on the control the eye already goes
 * to rather than on a badge somewhere to the right, so a list can be scanned
 * for what is urgent in one pass down the left-hand edge.
 */
export function TodoCheckbox({
  completed,
  priority,
  /** `0`–`1`, or `null` when this todo has no timer running. */
  progress,
  onToggle,
  className,
}: {
  completed: boolean;
  priority: TodoPriority;
  progress: number | null;
  onToggle: () => void;
  className?: string;
}) {
  const meta = priorityMeta(priority);
  const isRunning = progress !== null;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={completed}
      aria-label={completed ? "Mark as not done" : "Mark as done"}
      className={cn(
        "group/check relative grid size-5 shrink-0 place-items-center rounded-full",
        "transition-transform duration-150 ease-out hover:scale-110 active:scale-95",
        "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        meta.className,
        completed && "text-primary",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-5 -rotate-90" aria-hidden>
        {/*
          The track. Dashed while idle — the shape the page is named for — and
          solid once there is a countdown to be the background of, since dashes
          under a filling arc read as a broken arc.
        */}
        <circle
          cx="12"
          cy="12"
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={cn(
            "transition-opacity",
            isRunning || completed ? "opacity-25" : "opacity-70",
          )}
          strokeDasharray={isRunning || completed ? undefined : "3 3"}
        />

        {/* The countdown itself, unwinding clockwise from the top. */}
        {isRunning && (
          <circle
            cx="12"
            cy="12"
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
            // Matched to the tick that drives it, so the arc creeps rather than
            // stepping once a second.
            className="transition-[stroke-dashoffset] duration-1000 ease-linear"
          />
        )}

        {completed && (
          <circle cx="12" cy="12" r={RADIUS} fill="currentColor" className="opacity-100" />
        )}
      </svg>

      {/*
        The tick sits over the ring: solid once done, and a hint of one under the
        pointer so it is obvious what the circle is for before it has been used.
      */}
      <Check
        className={cn(
          "absolute size-3 stroke-[3] transition-opacity",
          completed
            ? "text-primary-foreground opacity-100"
            : "opacity-0 group-hover/check:opacity-40",
        )}
        aria-hidden
      />
    </button>
  );
}
