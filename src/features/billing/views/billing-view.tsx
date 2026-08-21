"use client";

import { useMutation } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CreditCard, ExternalLink, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useEntitlements } from "@/features/billing/hooks/use-entitlements";
import { usePaywall } from "@/features/billing/hooks/use-paywall";
import { formatPrice, PLANS } from "@/features/billing/lib/plans";
import type { UsageKind } from "@/generated/prisma/enums";
import { useTRPC } from "@/trpc/client";
import { cn } from "@/lib/utils";

/**
 * The plan, the meter, and what the meter went on.
 *
 * Three questions and no more: what am I on, how much is left, and where did it
 * go. Anything to do with the card, the invoices or cancelling is Polar's own
 * portal — building those here would mean handling payment details, which is
 * most of the reason to be using a merchant of record at all.
 */

/** What each priced action is called, for somebody reading their own bill. */
const USAGE_LABELS: Record<UsageKind, string> = {
  CHAT_FAST: "Questions",
  CHAT_FRONTIER: "Questions, frontier models",
  DOCUMENT: "Documents read",
  OCR: "Scanned documents transcribed",
};

export function BillingView() {
  const trpc = useTRPC();
  const params = useSearchParams();
  const { entitlements, isLoading, refetch } = useEntitlements();
  const { open } = usePaywall();

  const justPaid = params.get("checkout") === "complete";

  /*
    "Still confirming" is derived, not stored.

    It was a `useState` set from inside the effect below, which React now warns
    about for good reason: setting state synchronously in an effect schedules a
    second render before the first has been painted. Everything it was tracking
    is already known — whether we came back from a checkout, whether the plan
    has landed, and whether we have waited long enough — so it is computed
    instead, and the only state left is the one genuinely new fact: that the
    waiting window has closed.
  */
  const [gaveUp, setGaveUp] = useState(false);
  const settling = justPaid && !gaveUp && !entitlements?.isPaid;

  /*
    Coming back from a successful checkout does not mean the subscription
    exists yet.

    Polar redirects the browser the moment the payment clears, and the webhook
    that actually grants the plan arrives on its own schedule — usually within a
    second, occasionally not. So this polls its own entitlements rather than
    trusting the redirect, and says "confirming" until the tier actually
    changes. The alternative is a page that says "You are on Free" to somebody
    who has just paid, which is the worst possible moment to be wrong.
  */
  useEffect(() => {
    if (!settling) return;

    const poll = setTimeout(() => void refetch(), 1500);
    // Ten tries or so, then stop claiming to be working on it. A webhook that
    // has not arrived in fifteen seconds is not going to be waited out by a
    // spinner, and the page below is still true and still useful.
    const stop = setTimeout(() => setGaveUp(true), 15_000);

    return () => {
      clearTimeout(poll);
      clearTimeout(stop);
    };
  }, [settling, refetch]);

  /*
    The confirmation, said once.

    A ref rather than state, and not for performance: "have I already said
    this" is not something the page renders, so storing it in state would
    schedule a render that changes nothing — which is exactly the cascade the
    lint above is there to catch. The guard survives re-renders, which is all it
    has to do.

    Keyed off `isPaid` becoming true rather than off the poll firing, so a
    refetch that lands twice cannot toast twice, and somebody opening this page
    on a plan they bought last month is not congratulated again.
  */
  const announced = useRef(false);
  useEffect(() => {
    if (!justPaid || announced.current || !entitlements?.isPaid) return;
    announced.current = true;
    toast.success("You are all set — your plan is active.");
  }, [justPaid, entitlements?.isPaid]);

  const usage = useQuery({
    ...trpc.billing.usage.queryOptions(),
    staleTime: 30_000,
  });

  const portal = useMutation(
    trpc.billing.portal.mutationOptions({
      onSuccess: ({ url }) => window.location.assign(url),
      onError: (error) => toast.error(error.message),
    }),
  );

  if (isLoading || !entitlements) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const plan = PLANS[entitlements.tier];
  const used = Math.max(
    0,
    entitlements.creditsGranted - entitlements.creditsRemaining,
  );
  const fraction =
    entitlements.creditsGranted > 0
      ? Math.min(1, entitlements.creditsRemaining / entitlements.creditsGranted)
      : 0;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold">Billing</h1>
        <p className="text-sm text-muted-foreground">
          Your plan, what is left of this month&rsquo;s credits, and where they went.
        </p>
      </div>

      {settling && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-4">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Confirming your payment. This usually takes a second.
          </p>
        </div>
      )}

      {/* The plan */}
      <section className="flex flex-col gap-4 rounded-lg border p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">{plan.name}</h2>
              {entitlements.endingAt && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium tracking-wide text-amber-800 uppercase dark:bg-amber-950 dark:text-amber-300">
                  Ends {format(new Date(entitlements.endingAt), "d MMM")}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{plan.tagline}</p>
          </div>

          <div className="flex items-center gap-2">
            {entitlements.isPaid ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => portal.mutate()}
                disabled={portal.isPending}
              >
                {portal.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <CreditCard />
                )}
                Manage
                <ExternalLink className="size-3 opacity-60" />
              </Button>
            ) : null}
            <Button size="sm" onClick={() => open()}>
              {entitlements.isPaid ? "Change plan" : "Upgrade"}
            </Button>
          </div>
        </div>

        {entitlements.isPaid && entitlements.tier !== "FREE" && (
          <p className="text-xs text-muted-foreground">
            {formatPrice(plan.price.MONTHLY ?? 0)} a month
            {entitlements.endingAt
              ? " · will not renew"
              : " · renews automatically"}
          </p>
        )}
      </section>

      {/* The meter */}
      <section className="flex flex-col gap-3 rounded-lg border p-5">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-medium">Credits</h2>
          <p className="text-xs text-muted-foreground">
            Refills {format(new Date(entitlements.renewsAt), "d MMM")}
          </p>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold tabular-nums">
            {entitlements.creditsRemaining}
          </span>
          <span className="text-sm text-muted-foreground tabular-nums">
            of {entitlements.creditsGranted} left
          </span>
        </div>

        <div
          role="progressbar"
          aria-valuenow={entitlements.creditsRemaining}
          aria-valuemin={0}
          aria-valuemax={entitlements.creditsGranted}
          aria-label="Credits remaining this cycle"
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500",
              fraction <= 0.2 ? "bg-amber-500" : "bg-primary",
            )}
            style={{ width: `${Math.max(2, fraction * 100)}%` }}
          />
        </div>

        {used > 0 && (
          <p className="text-xs text-muted-foreground">
            {used} spent this cycle.
          </p>
        )}
      </section>

      {/* Where they went */}
      <section className="flex flex-col gap-3 rounded-lg border p-5">
        <h2 className="text-sm font-medium">This cycle</h2>

        {usage.isLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : !usage.data || usage.data.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nothing spent yet. Ask a question or upload a document to get going.
          </p>
        ) : (
          <ul className="flex flex-col divide-y">
            {usage.data.map((row) => (
              <li
                key={row.kind}
                className="flex items-center justify-between gap-4 py-2.5 text-sm"
              >
                <span className="min-w-0 truncate">
                  {USAGE_LABELS[row.kind]}
                  <span className="ms-2 text-xs text-muted-foreground tabular-nums">
                    &times;{row.count}
                  </span>
                </span>
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                  {row.credits} {row.credits === 1 ? "credit" : "credits"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
