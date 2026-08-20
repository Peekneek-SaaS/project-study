"use client";

import { motion } from "motion/react";
import { Check, FileText, Timer } from "lucide-react";

import { listContainer, listItem } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * The planner.
 *
 * Filed by the day the task is *due*, not the day it was written, and badged
 * with the document it came from — which is the whole argument for tasks living
 * here rather than inside each document. A task is something you have to do on
 * a day; a planner that hid the ones attached to your reading would be lying
 * about the day.
 *
 * The timer chip is real too: a todo can carry how long you think it will take,
 * and run it down.
 */
const PRIORITY = {
  URGENT: "border-primary/30 bg-primary/10 text-primary",
  HIGH: "border-[oklch(0.75_0.15_60_/_0.35)] bg-[oklch(0.75_0.15_60_/_0.12)] text-[oklch(0.5_0.14_55)]",
  MEDIUM: "border-border bg-muted text-foreground/55",
  LOW: "border-border bg-muted text-foreground/40",
} as const;

const DAYS = [
  {
    day: "Today",
    date: "Thu 21 Aug",
    tasks: [
      {
        title: "Redraw Fig 4.3 on the board from memory",
        priority: "URGENT" as const,
        doc: "Cell Structure",
        timer: "25m",
        done: false,
      },
      {
        title: "Re-read pages 11–13 and note the wording traps",
        priority: "HIGH" as const,
        doc: "Cell Structure",
        timer: "40m",
        done: false,
      },
      {
        title: "Skim the lecture deck for anything not in the chapter",
        priority: "MEDIUM" as const,
        doc: "Lecture 09",
        timer: null,
        done: true,
      },
    ],
  },
  {
    day: "Tomorrow",
    date: "Fri 22 Aug",
    tasks: [
      {
        title: "Past paper — transport questions only",
        priority: "HIGH" as const,
        doc: null,
        timer: "1h 30m",
        done: false,
      },
      {
        title: "Ask the seminar about aquaporin density",
        priority: "LOW" as const,
        doc: "Cell Structure",
        timer: null,
        done: false,
      },
    ],
  },
] as const;

export function TodoMockup({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-none border border-border bg-card",
        className,
      )}
    >
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border bg-muted/50 px-2.5">
        <span className="rounded-none bg-background px-1.5 py-0.5 text-[10px] font-medium text-foreground">
          By day
        </span>
        <span className="px-1.5 py-0.5 text-[10px] text-foreground/40">Board</span>
        <span className="ml-auto font-mono text-[9.5px] text-foreground/35">
          2 of 5 done
        </span>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-hidden p-4">
        {DAYS.map((group) => (
          <div key={group.day}>
            <div className="mb-2 flex items-baseline gap-2 border-b border-border pb-1.5">
              <p className="text-[11px] font-semibold text-foreground">
                {group.day}
              </p>
              <p className="font-mono text-[9.5px] text-foreground/30">
                {group.date}
              </p>
            </div>

            <motion.div
              variants={listContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              className="space-y-1"
            >
              {group.tasks.map((task) => (
                <motion.div
                  key={task.title}
                  variants={listItem}
                  className="flex items-start gap-2 py-1"
                >
                  <span
                    className={cn(
                      "mt-px grid size-3.5 shrink-0 place-items-center rounded-none border",
                      task.done
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-foreground/25",
                    )}
                  >
                    {task.done ? <Check className="size-2.5" /> : null}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-[10.5px] leading-snug",
                        task.done
                          ? "text-foreground/35 line-through"
                          : "text-foreground/85",
                      )}
                    >
                      {task.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <span
                        className={cn(
                          "rounded-none border px-1 py-px font-mono text-[8.5px] tracking-wide uppercase",
                          PRIORITY[task.priority],
                        )}
                      >
                        {task.priority}
                      </span>
                      {task.doc ? (
                        <span className="inline-flex items-center gap-0.5 rounded-none border border-border bg-muted px-1 py-px text-[8.5px] text-foreground/45">
                          <FileText className="size-2" />
                          {task.doc}
                        </span>
                      ) : null}
                      {task.timer ? (
                        <span className="inline-flex items-center gap-0.5 rounded-none border border-border bg-muted px-1 py-px font-mono text-[8.5px] text-foreground/45">
                          <Timer className="size-2" />
                          {task.timer}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        ))}
      </div>
    </div>
  );
}
