"use client";

import { useUser } from "@clerk/nextjs";
import { motion } from "motion/react";

import { fadeUp, listContainer, listItem, mountAnimation } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * What an empty chat says for itself.
 *
 * Named where a name is known, because the greeting is the one moment the app
 * speaks first and a name is the cheapest thing that makes it feel addressed to
 * someone. Falls back to the plain greeting rather than a placeholder — "Good
 * evening, there" is worse than "Good evening".
 *
 * The suggestions underneath are not decoration. An empty chat over a drive of
 * documents is a blank page problem: users do not know what it can do until
 * they see the shape of a question that works, and one press is a much lower
 * bar than composing the first one themselves.
 */

/** Morning, afternoon or evening, from the reader's own clock. */
function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function ChatGreeting({
  title,
  subtitle,
  className,
}: {
  /** Overrides the time-of-day greeting — the document panel names a document. */
  title?: string;
  subtitle?: string;

  className?: string;
}) {
  const { user } = useUser();

  // Computed during render rather than in state: it is read once as the page
  // mounts, and nobody is watching an empty chat at the moment the hour turns.
  const heading =
    title ??
    (user?.firstName ? `${greeting()}, ${user.firstName}` : greeting());

  return (
    <motion.div
      {...mountAnimation}
      variants={listContainer}
      className={cn("flex flex-col items-center gap-3 text-center", className)}
    >
      <motion.h1
        variants={fadeUp}
        className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl"
      >
        {heading}
      </motion.h1>

      {subtitle && (
        <motion.p
          variants={fadeUp}
          className="max-w-md text-sm text-balance text-muted-foreground"
        >
          {subtitle}
        </motion.p>
      )}
    </motion.div>
  );
}
