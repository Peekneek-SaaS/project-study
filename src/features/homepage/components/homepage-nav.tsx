"use client";

import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";

import Logo from "@/components/logo";
import { CtaButton } from "@/features/homepage/components/cta-button";
import { SIGN_IN_PATH, SIGN_UP_PATH } from "@/features/homepage/lib/design";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** In-page anchors. The homepage is one document, so the nav scrolls it. */
const LINKS = [
  { label: "Workspace", href: "#workspace" },
  { label: "How it works", href: "#pipeline" },
  { label: "Answers", href: "#answers" },
  { label: "Everything in it", href: "#everything" },
] as const;

/**
 * The bar that follows you down the page.
 *
 * Transparent over the hero and opaque once you have left it — the hero has a
 * wash behind it that a solid bar would cut a hard line across, and a blurred
 * bar over a plain white section is a smudge. `useMotionValueEvent` on the
 * scroll position rather than a scroll listener in an effect: it runs off the
 * same frame loop as everything else moving on the page, so the switch does
 * not land a frame late during a fast flick.
 *
 * The threshold is deliberately short. It fires while the hero is still mostly
 * on screen, which is what makes the bar feel attached to the scroll rather
 * than to a section boundary somewhere below the fold.
 */
export function HomepageNav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 24);
  });

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-colors duration-300",
        scrolled
          ? "border-b border-border bg-background/85 backdrop-blur-md"
          : "border-b border-transparent",
      )}
    >
      <nav className="mx-auto flex h-16 w-full max-w-[1280px] items-center justify-between gap-6 border-border px-5 sm:px-8">
        <div className="flex items-center gap-8">
          <Logo href="/" />
          <div className="hidden items-center gap-1 lg:flex">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-none px-3 py-2 text-[13px] font-medium text-foreground/65 transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/*
            Deliberately not branched on whether anyone is signed in.

            Clerk v7 replaced `SignedIn`/`SignedOut` with `<Show when=...>`,
            which renders `null` while auth is still loading — so a nav that
            swapped its buttons on session state would arrive empty and fill in
            a beat later, on every single visit, at the most-looked-at corner
            of the page. Two static links cost a signed-in visitor one
            redirect, which Clerk does for them anyway, and cost everyone else
            nothing.
          */}
          <CtaButton href={SIGN_IN_PATH} tone="outline" className="hidden sm:inline-flex">
            Sign in
          </CtaButton>
          <CtaButton href={SIGN_UP_PATH} tone="solid">
            Start for free
            <ArrowRight />
          </CtaButton>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="grid size-9 place-items-center rounded-none border border-border bg-card text-foreground transition-colors hover:bg-muted lg:hidden"
          >
            {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </nav>

      {/* The small-screen drawer. Height, not opacity — see `AnnouncementBar`. */}
      <AnimatePresence initial={false}>
        {menuOpen ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: DURATION.exit, ease: EASE_OUT }}
            className="overflow-hidden border-t border-border bg-background lg:hidden"
          >
            <div className="flex flex-col px-5 py-2 sm:px-8">
              {LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="border-b border-border py-3 text-sm font-medium text-foreground/70 transition-colors last:border-b-0 hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href={SIGN_IN_PATH}
                onClick={() => setMenuOpen(false)}
                className="border-t border-border py-3 text-sm font-medium text-foreground/70 sm:hidden"
              >
                Sign in
              </Link>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
