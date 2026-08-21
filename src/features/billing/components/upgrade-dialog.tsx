"use client";

import { useMutation } from "@tanstack/react-query";
import { Check, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEntitlements } from "@/features/billing/hooks/use-entitlements";
import type { GatedFeature } from "@/features/billing/hooks/use-paywall";
import {
  formatPrice,
  monthlyEquivalent,
  PLAN_LIST,
  yearlySaving,
  type Plan,
} from "@/features/billing/lib/plans";
import type { BillingPeriod, PlanTier } from "@/generated/prisma/enums";
import { useTRPC } from "@/trpc/client";
import { cn } from "@/lib/utils";

/**
 * The offer, at the moment somebody runs into a wall.
 *
 * Deliberately not a page. A paywall that navigates away loses whatever the
 * person was in the middle of — the half-written question, the file they had
 * selected — and makes upgrading feel like abandoning the task rather than
 * continuing it. They come back to the same screen with more credits.
 *
 * `highlight` is which plan to lead with, and it comes from what they were
 * trying to do rather than from what earns most: somebody stopped by the model
 * picker is shown Pro because that is the plan that answers their question, and
 * somebody who has merely run out of credits is shown Study because it is the
 * cheapest thing that helps.
 */

/** Why the dialog opened, in the sentence under the title. */
const REASONS: Record<GatedFeature, string> = {
  credits:
    "You have used this cycle's credits. A plan tops them up every month — and gives you room for more documents while it is at it.",
  documents:
    "Your plan is full. A larger one holds more documents, and reads longer ones.",
  ocr: "Scanned documents have to be read by a model, page by page. That is part of Study and Pro.",
  providerPicker:
    "Choosing which model answers — and getting the frontier models on every answer — is part of Pro.",
};

export function UpgradeDialog({
  open,
  onOpenChange,
  highlight = "STUDY",
  reason,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  highlight?: PlanTier;
  reason?: GatedFeature | null;
}) {
  const trpc = useTRPC();
  const { entitlements } = useEntitlements();

  /*
    Yearly first, and this is a considered default rather than a dark pattern.

    The saving is real and large, the monthly price is shown on the same card,
    and one click switches. Defaulting to monthly and hoping people find the
    yearly toggle is how a discount that was meant to be an offer becomes a
    thing only the diligent get.
  */
  const [period, setPeriod] = useState<BillingPeriod>("YEARLY");

  const checkout = useMutation(
    trpc.billing.checkout.mutationOptions({
      onSuccess: ({ url }) => {
        // A full navigation rather than a new tab: Polar's checkout is its own
        // page and comes back here on success. A popup would be blocked as
        // often as not, and a blocked payment is a lost one.
        //
        // `assign` rather than setting `location.href`, which the immutability
        // lint reads as mutating a global — the same navigation, said as a call.
        window.location.assign(url);
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const plans = PLAN_LIST.filter((plan) => plan.tier !== "FREE");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        <DialogHeader className="gap-2 px-6 pt-6 pb-4 text-left">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="size-4 text-primary" />
            {reason === "credits" ? "You are out of credits" : "Room to keep going"}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {reason
              ? REASONS[reason]
              : "Every plan reads your documents, cites the page and keeps your notes. What changes is how much you can put through it."}
          </DialogDescription>
        </DialogHeader>

        <PeriodToggle period={period} onChange={setPeriod} />

        <div className="grid gap-3 px-6 pt-4 pb-6 sm:grid-cols-2">
          {plans.map((plan) => (
            <PlanCard
              key={plan.tier}
              plan={plan}
              period={period}
              featured={plan.tier === highlight}
              current={entitlements?.tier === plan.tier}
              pending={
                checkout.isPending && checkout.variables?.tier === plan.tier
              }
              disabled={checkout.isPending}
              onChoose={() => checkout.mutate({ tier: plan.tier as "STUDY" | "PRO", period })}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Monthly or yearly.
 *
 * A segmented control rather than a switch. A switch has an implicit "off",
 * which for a pair of equally valid choices means one of them reads as the
 * absence of the other — and the saving badge has nowhere to live.
 */
export function PeriodToggle({
  period,
  onChange,
  className,
}: {
  period: BillingPeriod;
  onChange: (period: BillingPeriod) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex justify-center px-6", className)}>
      <div
        role="radiogroup"
        aria-label="Billing period"
        className="inline-flex items-center gap-1 rounded-full border bg-muted/50 p-1"
      >
        {(["MONTHLY", "YEARLY"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={period === value}
            onClick={() => onChange(value)}
            className={cn(
              "rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              period === value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {value === "MONTHLY" ? "Monthly" : "Yearly"}
            {value === "YEARLY" && (
              <span className="ms-1.5 text-primary">
                &minus;{yearlySaving(PLAN_LIST[1]) ?? 0}%
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  period,
  featured,
  current,
  pending,
  disabled,
  onChoose,
}: {
  plan: Plan;
  period: BillingPeriod;
  featured: boolean;
  current: boolean;
  pending: boolean;
  disabled: boolean;
  onChoose: () => void;
}) {
  const price = plan.price[period] ?? 0;

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-lg border p-5",
        // The featured card is marked with a ring rather than by being bigger.
        // A card that grows shifts the one beside it, and the two have to be
        // comparable at a glance for the comparison to be worth showing.
        featured ? "border-primary ring-1 ring-primary" : "bg-muted/20",
      )}
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold">{plan.name}</h3>
          {current && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              Current
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{plan.tagline}</p>
      </div>

      <div className="flex flex-col gap-0.5">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-semibold tabular-nums">
            {period === "YEARLY" ? monthlyEquivalent(price) : formatPrice(price)}
          </span>
          <span className="text-xs text-muted-foreground">/month</span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {period === "YEARLY"
            ? `${formatPrice(price)} billed yearly`
            : "billed monthly"}
        </p>
      </div>

      <ul className="flex flex-1 flex-col gap-2">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-xs">
            <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <span className="text-muted-foreground">{feature}</span>
          </li>
        ))}
      </ul>

      <Button
        onClick={onChoose}
        disabled={disabled || current}
        variant={featured ? "default" : "outline"}
        className="w-full"
      >
        {pending && <Loader2 className="animate-spin" />}
        {current ? "Your plan" : `Choose ${plan.name}`}
      </Button>
    </div>
  );
}
