import { Show } from "@clerk/nextjs";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  INK,
  INK_BORDER,
  INK_FAINT,
  SIGN_IN_PATH,
  SIGN_UP_PATH,
} from "@/features/homepage/lib/design";
import { BOARDS_PATH } from "@/features/board/types";
import { CHAT_PATH } from "@/features/chat/types";
import { DRIVE_PATH } from "@/features/main/types";
import { STICKY_NOTES_PATH } from "@/features/sticky-notes/types";
import { TODO_PATH } from "@/features/todo/types";
import { SITE_NAME } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * The footer.
 *
 * A server component — there is nothing here that moves, and a page that has
 * been animating for twelve sections should stop before its last one. The
 * product routes are imported from each feature's `types` module rather than
 * written as strings, so a route that gets renamed takes this with it.
 *
 * Being a server component already is what lets the last column use `Show`
 * directly. The nav, the hero and the closing band all have to be *handed*
 * their auth-dependent buttons because they are client components; nothing
 * here runs in the browser, so this one can simply ask.
 */

/** The two columns that read the same to everybody. */
const COLUMNS = [
  {
    heading: "Workspace",
    links: [
      { label: "Your documents", href: DRIVE_PATH },
      { label: "Boards", href: BOARDS_PATH },
      { label: "Sticky notes", href: STICKY_NOTES_PATH },
      { label: "Tasks", href: TODO_PATH },
      { label: "Chat", href: CHAT_PATH },
    ],
  },
  {
    heading: "On this page",
    links: [
      { label: "The workspace", href: "#workspace" },
      { label: "How it works", href: "#pipeline" },
      { label: "How answers are grounded", href: "#answers" },
      { label: "Everything in it", href: "#everything" },
    ],
  },
] as const;

/**
 * The last column, which is a different column depending on who is reading.
 *
 * The heading swaps along with the links rather than staying put: "Get
 * started" over a link to your own dashboard is the same mismatch as "Start
 * for free" in the nav, just quieter. Signed in there is only one honest link
 * to put here — the app has no settings or support route of its own to point
 * at — and one link is a perfectly ordinary size for a footer column.
 */
function AccountColumn() {
  return (
    <Show
      when="signed-in"
      fallback={
        <FooterColumn heading="Get started">
          <FooterLink href={SIGN_UP_PATH}>Create an account</FooterLink>
          <FooterLink href={SIGN_IN_PATH}>Sign in</FooterLink>
        </FooterColumn>
      }
    >
      <FooterColumn heading="Your account">
        <FooterLink href={DRIVE_PATH}>Dashboard</FooterLink>
      </FooterColumn>
    </Show>
  );
}

function FooterColumn({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="font-mono text-[10.5px] tracking-[0.12em] text-[oklch(1_0_0_/_0.35)] uppercase">
        {heading}
      </p>
      <ul className="mt-4 space-y-2.5">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="text-[13px] text-[oklch(1_0_0_/_0.6)] transition-colors hover:text-[oklch(0.99_0_0)]"
      >
        {children}
      </Link>
    </li>
  );
}

export function HomepageFooter() {
  return (
    <footer className={cn("border-t", INK, INK_BORDER)}>
      <div className={cn("mx-auto w-full max-w-[1280px] border-x", INK_BORDER)}>
        <div className="grid gap-10 px-5 py-14 sm:grid-cols-2 sm:px-8 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <p className="text-lg font-semibold tracking-tighter text-[oklch(0.99_0_0)]">
              {SITE_NAME}
            </p>
            <p className={cn("mt-3 max-w-xs text-[13px] leading-relaxed", INK_FAINT)}>
              Turn your documents into a workspace: read a PDF, deck or Word
              file beside a board you can draw on and notes you can keep.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <FooterColumn key={column.heading} heading={column.heading}>
              {column.links.map((link) => (
                <FooterLink key={link.label} href={link.href}>
                  {link.label}
                </FooterLink>
              ))}
            </FooterColumn>
          ))}

          <AccountColumn />
        </div>

        <div
          className={cn(
            "flex flex-col gap-2 border-t px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8",
            INK_BORDER,
          )}
        >
          <p className={cn("text-[12px]", INK_FAINT)}>
            © {new Date().getFullYear()} {SITE_NAME}. All rights reserved.
          </p>
          <p className={cn("font-mono text-[11px] tracking-[0.08em] uppercase", INK_FAINT)}>
            Built for people with too much to read
          </p>
        </div>
      </div>
    </footer>
  );
}
