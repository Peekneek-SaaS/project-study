"use client";

import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
} from "motion/react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";

import Logo from "@/components/logo";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";

/** In-page anchors. The homepage is one document, so the nav scrolls it. */
const LINKS = [
  { label: "Workspace", href: "#workspace" },
  { label: "How it works", href: "#pipeline" },
  { label: "Answers", href: "#answers" },
  { label: "Everything in it", href: "#everything" },
  { label: "Pricing", href: "#pricing" },
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
 *
 * The two auth-dependent slots arrive as props rather than being rendered
 * here. They are server components — see `auth-cta` — and this file is a
 * client one, so it cannot import them; taking them as `ReactNode` lets the
 * server decide what a signed-in visitor sees while the scroll behaviour and
 * the drawer stay in the browser where they belong.
 */
export function HomepageNav({
  authCta,
  menuAuthLink,
}: {
  authCta: ReactNode;
  menuAuthLink: ReactNode;
}) {
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
          {authCta}

          <Button
            variant="outline"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="size-9 flex lg:hidden"
          >
            {menuOpen ? <X className="size-4" /> : <Menu className="size-4 " />}
          </Button>
          <ModeToggle className="size-9" />
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
              {menuAuthLink}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
