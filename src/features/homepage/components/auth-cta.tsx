import { Show } from "@clerk/nextjs";
import { ArrowRight } from "lucide-react";

import { CtaButton } from "@/features/homepage/components/cta-button";
import { SIGN_IN_PATH, SIGN_UP_PATH } from "@/features/homepage/lib/design";
import { DRIVE_PATH } from "@/features/main/types";

/**
 * The calls to action that depend on whether anyone is signed in.
 *
 * Deliberately *not* a client component, and that is the whole design. Clerk's
 * `Show` comes in two versions: the one in `@clerk/react` is a hook that
 * renders `null` until the session has loaded in the browser, while the one
 * exported from `@clerk/nextjs` — this one — is an async server component that
 * `await`s `auth()` before rendering anything.
 *
 * Using the server version means the first paint is already correct: a signed
 * -in visitor never sees "Start for free" flash and swap, because the HTML
 * that left the server said "Dashboard". That is the flicker this file exists
 * to avoid, and it is only avoidable *because* the decision happens on the
 * server.
 *
 * The cost is that `auth()` reads the request, so any page rendering these can
 * no longer be prerendered at build time — see `homepage-view` for how the
 * page keeps the rest of itself static anyway.
 *
 * These are passed into the nav and the hero as props rather than imported by
 * them, because both of those are client components and a client component
 * cannot import a server one. Handing them down as already-rendered children
 * is the supported way round it.
 */

/** The nav's right-hand side. Two buttons signed out, one signed in. */
export function NavAuthCta() {
  return (
    <Show
      when="signed-in"
      fallback={
        <>
          <CtaButton
            href={SIGN_IN_PATH}
            tone="outline"
            className="hidden sm:inline-flex"
          >
            Sign in
          </CtaButton>
          <CtaButton href={SIGN_UP_PATH} tone="solid">
            Start for free
            <ArrowRight />
          </CtaButton>
        </>
      }
    >
      <CtaButton href={DRIVE_PATH} tone="solid">
        Dashboard
        <ArrowRight />
      </CtaButton>
    </Show>
  );
}

/**
 * The same decision, for the small-screen drawer.
 *
 * Signed out this is only shown below `sm`, where the nav has dropped its
 * "Sign in" button to make room; signed in there is no hidden button to stand
 * in for, but "Dashboard" is worth repeating in the drawer anyway — it is the
 * one link a returning visitor on a phone is looking for.
 */
export function NavMenuAuthLink() {
  const className =
    "border-t border-border py-3 text-sm font-medium text-foreground/70 transition-colors hover:text-foreground";

  return (
    <Show
      when="signed-in"
      fallback={
        <a href={SIGN_IN_PATH} className={`${className} sm:hidden`}>
          Sign in
        </a>
      }
    >
      <a href={DRIVE_PATH} className={className}>
        Dashboard
      </a>
    </Show>
  );
}

/** The hero's primary button. Its "See it work" neighbour never changes. */
export function HeroAuthCta() {
  return (
    <Show
      when="signed-in"
      fallback={
        <CtaButton href={SIGN_UP_PATH} tone="solid" size="lg">
          Start for free
          <ArrowRight />
        </CtaButton>
      }
    >
      <CtaButton href={DRIVE_PATH} tone="solid" size="lg">
        Dashboard
        <ArrowRight />
      </CtaButton>
    </Show>
  );
}

/**
 * The closing band's buttons, in the ink tones that band uses.
 *
 * Signed out it is the page's last ask — sign up, or sign in if you already
 * did. Signed in there is nothing left to ask for, so the pair collapses to
 * the single door: someone who read to the bottom of the page while already
 * having an account wants their documents, not a second one.
 */
export function FinalCtaAuthCta() {
  return (
    <Show
      when="signed-in"
      fallback={
        <>
          <CtaButton href={SIGN_UP_PATH} tone="inkSolid" size="lg">
            Start for free
            <ArrowRight />
          </CtaButton>
          <CtaButton href={SIGN_IN_PATH} tone="inkOutline" size="lg">
            Sign in
          </CtaButton>
        </>
      }
    >
      <CtaButton href={DRIVE_PATH} tone="inkSolid" size="lg">
        Dashboard
        <ArrowRight />
      </CtaButton>
    </Show>
  );
}
