"use client";

import { Lock, Zap } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  GATED_FEATURES,
  usePaywall,
  type GatedFeature,
} from "@/features/billing/hooks/use-paywall";
import { PLANS } from "@/features/billing/lib/plans";
import { cn } from "@/lib/utils";

/**
 * The three shapes a barrier takes, so that no feature has to invent a fourth.
 *
 * A paywall is not one component, because "you cannot do this" arrives in
 * genuinely different ways: something is disabled, something is replaced, or
 * something is simply reported. What they share is where the answer comes from
 * — `usePaywall`, which is checked against the same plan catalogue the server
 * enforces — so a gate added here cannot claim a limit that does not exist.
 */

/**
 * Renders `children` only if the plan allows it, and an offer if it does not.
 *
 * For whole regions: a panel, a tab, a section of settings. The fallback is an
 * offer rather than a blank, because an empty space where a feature used to be
 * reads as a bug and teaches nobody that a plan exists.
 */
export function Paywall({
  feature,
  children,
  title,
  description,
  className,
}: {
  feature: GatedFeature;
  children: ReactNode;
  title?: string;
  description?: string;
  className?: string;
}) {
  const { can, open } = usePaywall();

  if (can(feature)) return <>{children}</>;

  const required = PLANS[GATED_FEATURES[feature].tier];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center",
        className,
      )}
    >
      <Lock className="size-5 text-muted-foreground" />
      <div className="space-y-1">
        <p className="text-sm font-medium">
          {title ?? `${GATED_FEATURES[feature].label} is part of ${required.name}`}
        </p>
        <p className="max-w-sm text-xs text-muted-foreground">
          {description ?? required.tagline}
        </p>
      </div>
      <Button size="sm" onClick={() => open(feature)}>
        See plans
      </Button>
    </div>
  );
}

/**
 * A button that opens the offer instead of doing the thing.
 *
 * For controls that must stay visible and clickable — the upload button, the
 * model picker. Disabling them instead would be quieter and worse: a greyed
 * control with a tooltip is a dead end, whereas a control that explains itself
 * when pressed is the only route anyone will actually take.
 */
export function PaywallButton({
  feature,
  children,
  onClick,
  ...props
}: React.ComponentProps<typeof Button> & { feature: GatedFeature }) {
  const { require } = usePaywall();

  return (
    <Button
      {...props}
      onClick={(event) => {
        if (!require(feature)) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    >
      {children}
    </Button>
  );
}

/**
 * What is left, as a number and a bar.
 *
 * Shown wherever credits are actually spent rather than hidden in settings: a
 * meter somebody has to go looking for is one they find for the first time when
 * it reads zero. Below a fifth it turns amber, which is the only warning this
 * app gives before an answer is refused.
 */
export function CreditMeter({ className }: { className?: string }) {
  const { entitlements, open } = usePaywall();

  if (!entitlements) return null;

  const { creditsRemaining, creditsGranted, plan } = entitlements;
  const fraction =
    creditsGranted > 0 ? Math.min(1, creditsRemaining / creditsGranted) : 0;
  const low = fraction <= 0.2;

  return (
    <button
      type="button"
      onClick={() => open(creditsRemaining <= 0 ? "credits" : undefined)}
      className={cn(
        "flex w-full flex-col gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted/60",
        className,
      )}
    >
      <span className="flex items-center justify-between gap-2 text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Zap className={cn("size-3.5", low && "text-amber-600")} />
          {plan.name}
        </span>
        <span
          className={cn(
            "font-medium tabular-nums",
            low ? "text-amber-600" : "text-muted-foreground",
          )}
        >
          {creditsRemaining}
          <span className="text-muted-foreground/60">/{creditsGranted}</span>
        </span>
      </span>

      {/* A plain div rather than the Progress component: this one is 3px tall,
          has no label and changes colour, and dressing the shared component up
          to do that would leave it doing neither job well. */}
      <span
        role="progressbar"
        aria-valuenow={creditsRemaining}
        aria-valuemin={0}
        aria-valuemax={creditsGranted}
        aria-label="Credits remaining this cycle"
        className="h-1 w-full overflow-hidden rounded-full bg-muted"
      >
        <span
          className={cn(
            "block h-full rounded-full transition-[width] duration-500",
            low ? "bg-amber-500" : "bg-primary",
          )}
          style={{ width: `${Math.max(2, fraction * 100)}%` }}
        />
      </span>
    </button>
  );
}
