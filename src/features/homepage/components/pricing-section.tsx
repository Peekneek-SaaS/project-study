"use client";

import { ArrowRight, Check, Minus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import {
  Eyebrow,
  Reveal,
  RevealGroup,
  RevealItem,
  SectionHeading,
} from "@/features/homepage/components/homepage-primitives";
import { FRAME, SIGN_UP_PATH } from "@/features/homepage/lib/design";
import {
  CREDIT_COST,
  formatPrice,
  monthlyEquivalent,
  PLAN_LIST,
  yearlySaving,
  type Plan,
} from "@/features/billing/lib/plans";
import type { BillingPeriod } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

/**
 * What it costs, and what a credit actually buys.
 *
 * Read straight from `billing/lib/plans` — the same objects the server enforces
 * and the upgrade dialog sells. A pricing page that keeps its own copy of the
 * numbers is a pricing page that will eventually promise something the product
 * refuses, and the customer who finds that discrepancy is always the one who
 * counted.
 *
 * The comparison table is the part that earns its place. Three cards can say
 * what each plan includes but not what changes *between* them, and the decision
 * a reader is actually making is "is the next one up worth it" — which is a row
 * of three values, not three lists to hold in your head at once.
 *
 * The credit explainer under it exists because metered pricing fails in exactly
 * one way: nobody knows what a credit is. Saying "250 credits" to somebody who
 * has never used the product is saying nothing, so the row of four costs is
 * really the price list, and the plans above are just how many you get.
 */

/** The rows of the comparison, in the order they matter to somebody choosing. */
const COMPARISON: {
  label: string;
  value: (plan: Plan) => string | boolean;
}[] = [
  { label: "Credits each month", value: (plan) => plan.monthlyCredits.toLocaleString() },
  { label: "Documents", value: (plan) => plan.documentLimit.toLocaleString() },
  { label: "Pages per document", value: (plan) => plan.pageLimit.toLocaleString() },
  { label: "Searches per answer", value: (plan) => String(plan.maxSteps) },
  { label: "Scanned documents read", value: (plan) => plan.ocr },
  { label: "Choose your model", value: (plan) => plan.providerPicker },
  { label: "Frontier models by default", value: (plan) => plan.defaultModelTier === "frontier" },
  { label: "Notes, boards, todos, annotations", value: () => "Unlimited" },
];

/** What one credit buys, in the user's words rather than in tokens. */
const CREDIT_RATES = [
  { label: "A question", cost: CREDIT_COST.CHAT_FAST },
  { label: "A question, frontier model", cost: CREDIT_COST.CHAT_FRONTIER },
  { label: "100 pages read", cost: CREDIT_COST.DOCUMENT_PER_100_PAGES },
  { label: "5 scanned pages", cost: CREDIT_COST.OCR_PER_5_PAGES },
];

export function PricingSection() {
  const [period, setPeriod] = useState<BillingPeriod>("YEARLY");
  const saving = yearlySaving(PLAN_LIST[1]) ?? 0;

  return (
    <section id="pricing" className="border-t border-border">
      <div className={FRAME}>
        <div className="px-5 py-16 sm:px-8 sm:py-24">
          <Reveal>
            <Eyebrow>Pricing</Eyebrow>
            <SectionHeading
              className="mt-6"
              lead="Pay for what you put through it."
              rest="Your notes, boards and todos are unlimited on every plan, free included. Credits are only spent when a model does the work."
            />
          </Reveal>

          <Reveal delay={0.1} className="mt-10 flex justify-center">
            <div
              role="radiogroup"
              aria-label="Billing period"
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 p-1"
            >
              {(["MONTHLY", "YEARLY"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={period === value}
                  onClick={() => setPeriod(value)}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    period === value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-foreground/50 hover:text-foreground",
                  )}
                >
                  {value === "MONTHLY" ? "Monthly" : "Yearly"}
                  {value === "YEARLY" && saving > 0 && (
                    <span className="ms-1.5 text-primary">save {saving}%</span>
                  )}
                </button>
              ))}
            </div>
          </Reveal>
        </div>

        {/* The three plans */}
        <RevealGroup className="grid border-t border-border md:grid-cols-3">
          {PLAN_LIST.map((plan, index) => (
            <RevealItem
              key={plan.tier}
              className={cn(
                "flex flex-col border-b border-border p-6 sm:p-8 md:border-b-0",
                index < PLAN_LIST.length - 1 && "md:border-r",
                // Study is the one most people should be on, and it is marked
                // by a tint rather than by a badge that shouts. The card does
                // not grow: three cards a reader is comparing have to stay the
                // same size or the comparison becomes an optical one.
                plan.tier === "STUDY" && "bg-muted/30",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[15px] font-semibold text-foreground">
                  {plan.name}
                </h3>
                {plan.tier === "STUDY" && (
                  <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] tracking-[0.1em] text-primary uppercase">
                    Most take this
                  </span>
                )}
              </div>

              <p className="mt-2 min-h-[2.5rem] text-[13px] text-foreground/45">
                {plan.tagline}
              </p>

              <div className="mt-6 flex items-baseline gap-1.5">
                <span className="text-4xl font-semibold tracking-tight text-foreground tabular-nums">
                  {plan.price[period] === 0
                    ? "Free"
                    : period === "YEARLY"
                      ? monthlyEquivalent(plan.price.YEARLY ?? 0)
                      : formatPrice(plan.price.MONTHLY ?? 0)}
                </span>
                {plan.price[period] !== 0 && (
                  <span className="text-[13px] text-foreground/45">/month</span>
                )}
              </div>

              {/* The full charge, always shown. A monthly-equivalent price with
                  the yearly total hidden is the one piece of pricing sleight of
                  hand that reliably turns into a refund request. */}
              <p className="mt-1 font-mono text-[11px] text-foreground/35">
                {plan.price[period] === 0
                  ? `${plan.welcomeCredits} credits to start`
                  : period === "YEARLY"
                    ? `${formatPrice(plan.price.YEARLY ?? 0)} billed yearly`
                    : "billed monthly"}
              </p>

              <ul className="mt-6 flex flex-1 flex-col gap-2.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    <span className="text-[13px] text-foreground/60">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              {/*
                Every card goes to sign-up, including the paid ones.

                A logged-out reader cannot be sent to a checkout — Polar needs a
                customer to bill, and this app needs to know whose subscription
                it is. So the paid buttons say what will happen and the plan is
                chosen again inside, where there is an account to attach it to.
              */}
              <Link
                href={SIGN_UP_PATH}
                className={cn(
                  "group mt-8 inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2.5 text-[13px] font-medium transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  plan.tier === "STUDY"
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "border border-border text-foreground hover:bg-muted",
                )}
              >
                {plan.tier === "FREE" ? "Start for free" : `Start with ${plan.name}`}
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </RevealItem>
          ))}
        </RevealGroup>

        {/* What a credit is */}
        <div className="border-t border-border px-5 py-12 sm:px-8 sm:py-16">
          <Reveal>
            <p className="text-center font-mono text-[11px] tracking-[0.14em] text-foreground/35 uppercase">
              What a credit buys
            </p>
          </Reveal>

          <RevealGroup className="mx-auto mt-8 grid max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
            {CREDIT_RATES.map((rate) => (
              <RevealItem
                key={rate.label}
                className="flex flex-col items-center gap-1 bg-background px-4 py-6 text-center"
              >
                <span className="text-2xl font-semibold text-foreground tabular-nums">
                  {rate.cost}
                </span>
                <span className="font-mono text-[10px] tracking-[0.1em] text-foreground/35 uppercase">
                  {rate.cost === 1 ? "credit" : "credits"}
                </span>
                <span className="mt-1 text-[12px] text-foreground/55">
                  {rate.label}
                </span>
              </RevealItem>
            ))}
          </RevealGroup>

          <Reveal delay={0.1}>
            <p className="mx-auto mt-6 max-w-xl text-center text-[13px] text-foreground/45">
              Credits refill at the start of every month. Writing notes, drawing
              on boards, filing todos and annotating pages never costs any.
            </p>
          </Reveal>
        </div>

        {/* The comparison */}
        <div className="border-t border-border">
          <Reveal className="px-5 pt-12 sm:px-8">
            <p className="text-center font-mono text-[11px] tracking-[0.14em] text-foreground/35 uppercase">
              Side by side
            </p>
          </Reveal>

          {/* Its own scroller: three columns of numbers do not fit a phone, and
              a table that widens the page is worse than one that scrolls. */}
          <div className="overflow-x-auto px-5 py-8 sm:px-8">
            <table className="w-full min-w-[560px] border-collapse">
              <thead>
                <tr>
                  <th className="w-2/5 pb-4 text-left font-mono text-[10px] font-medium tracking-[0.1em] text-foreground/35 uppercase">
                    &nbsp;
                  </th>
                  {PLAN_LIST.map((plan) => (
                    <th
                      key={plan.tier}
                      className="pb-4 text-center text-[13px] font-semibold text-foreground"
                    >
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr key={row.label} className="border-t border-border">
                    <th
                      scope="row"
                      className="py-3 pe-4 text-left text-[13px] font-normal text-foreground/55"
                    >
                      {row.label}
                    </th>
                    {PLAN_LIST.map((plan) => {
                      const value = row.value(plan);
                      return (
                        <td
                          key={plan.tier}
                          className="py-3 text-center text-[13px] text-foreground tabular-nums"
                        >
                          {typeof value === "boolean" ? (
                            value ? (
                              <Check
                                className="mx-auto size-4 text-primary"
                                aria-label="Included"
                              />
                            ) : (
                              <Minus
                                className="mx-auto size-4 text-foreground/20"
                                aria-label="Not included"
                              />
                            )
                          ) : (
                            value
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
