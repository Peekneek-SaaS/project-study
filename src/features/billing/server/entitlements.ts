/**
 * No `server-only` marker here, deliberately.
 *
 * This module is imported by the Trigger.dev worker as well as by Next — the
 * chat and document tasks are where credits are actually spent. That package
 * resolves to a file that throws on import unless React's `react-server`
 * condition is set, which a plain Node bundle does not set.
 *
 * Nothing is lost by dropping it: everything here touches Prisma, which does
 * not survive a client bundle quietly.
 */

import { addMonths } from "date-fns";

import type { BillingAccount } from "@/generated/prisma/client";
import type { PlanTier, UsageKind } from "@/generated/prisma/enums";
import {
  atLeast,
  CREDIT_COST,
  PAGES_PER_DOCUMENT_CREDIT,
  PAGES_PER_OCR_CREDIT,
  PLANS,
  type ModelTier,
  type Plan,
} from "@/features/billing/lib/plans";
import {
  tagPlanError,
  type PlanErrorFeature,
} from "@/features/billing/lib/plan-errors";
import { prisma } from "@/lib/prisma";

/**
 * What an account may do, and what it has left.
 *
 * Every gate in the app goes through here rather than reading the tier itself,
 * which is what keeps "what does Study include" a question with one answer. The
 * shape is deliberately flat and serialisable: the same object is returned to
 * the browser by the billing router and read by the background tasks, so the
 * paywall in the UI and the refusal in the worker cannot disagree about what a
 * plan allows.
 */
export interface Entitlements {
  tier: PlanTier;
  plan: Plan;
  /** Whether a paid plan is currently in force. */
  isPaid: boolean;
  /** Whether the subscription has been cancelled but not yet run out. */
  endingAt: Date | null;
  creditsRemaining: number;
  creditsGranted: number;
  /** When the current allowance is refilled. */
  renewsAt: Date;
  /** Whether the account is out of credits. The paywall's usual trigger. */
  exhausted: boolean;
}

/**
 * Nothing left to spend.
 *
 * A named error rather than a boolean return, because it is thrown from inside
 * a Trigger.dev task where the alternative is a half-finished run that looks
 * like a crash. The message is written to be shown to the user as-is: this is
 * the sentence somebody reads when their answer does not arrive.
 */
export class InsufficientCreditsError extends Error {
  readonly required: number;
  readonly remaining: number;

  constructor(required: number, remaining: number) {
    super(
      tagPlanError(
        `This needs ${required} credit${required === 1 ? "" : "s"} and you ` +
          `have ${remaining} left. Your allowance refills at the start of ` +
          `your next cycle, or you can move to a larger plan for more.`,
        "credits",
      ),
    );
    this.name = "InsufficientCreditsError";
    this.required = required;
    this.remaining = remaining;
  }
}

/** A limit that is not about credits — documents, pages, a gated feature. */
export class PlanLimitError extends Error {
  readonly limit: PlanErrorFeature;

  constructor(limit: PlanErrorFeature, message: string) {
    super(tagPlanError(message, limit));
    this.name = "PlanLimitError";
    this.limit = limit;
  }
}

/**
 * The account row, created on first sight and refilled when its cycle is up.
 *
 * Lazily created rather than written at sign-up: there is no sign-up hook in
 * this app, Clerk owns that flow, and an account that has never opened the
 * product does not need a row. The first read makes one — with the welcome
 * credits already in it, which is why a brand new user can ask a question
 * immediately rather than after a webhook has caught up.
 *
 * The refill is here rather than in a scheduled job for the same reason: a cron
 * that has to run for the free tier to work is a cron whose failure looks like
 * a product that has stopped working. Reading is the trigger, so an account
 * refills the moment somebody comes back to it and never before.
 */
export async function ensureAccount(userId: string): Promise<BillingAccount> {
  const free = PLANS.FREE;

  const existing = await prisma.billingAccount.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      // The welcome float and the first month's grant arrive together, so the
      // first cycle is the largest one a free account ever gets.
      creditsRemaining: free.welcomeCredits + free.monthlyCredits,
      creditsGranted: free.welcomeCredits + free.monthlyCredits,
      welcomeGranted: true,
      cycleStart: new Date(),
      cycleEnd: addMonths(new Date(), 1),
    },
  });

  return rollCycle(existing);
}

/**
 * Refills an expired cycle, once.
 *
 * Guarded on `cycleEnd` in the `where` rather than checked and then written,
 * which is what makes two concurrent requests — a chat turn and an upload
 * arriving together — unable to grant the allowance twice. The loser of the
 * race updates no rows and re-reads the winner's result.
 *
 * A cycle that has been expired for months rolls forward one month at a time in
 * arithmetic, not in loops: whatever the gap, the next end is one month from
 * now, because nobody accrues allowances for the months they were not here.
 */
async function rollCycle(account: BillingAccount): Promise<BillingAccount> {
  const now = new Date();
  if (account.cycleEnd > now) return account;

  const plan = PLANS[account.tier];
  const { count } = await prisma.billingAccount.updateMany({
    where: { userId: account.userId, cycleEnd: { lte: now } },
    data: {
      creditsRemaining: plan.monthlyCredits,
      creditsGranted: plan.monthlyCredits,
      cycleStart: now,
      cycleEnd: addMonths(now, 1),
    },
  });

  if (count === 0) {
    // Somebody else rolled it. Their version is the true one.
    return (await prisma.billingAccount.findUniqueOrThrow({
      where: { userId: account.userId },
    })) satisfies BillingAccount;
  }

  return {
    ...account,
    creditsRemaining: plan.monthlyCredits,
    creditsGranted: plan.monthlyCredits,
    cycleStart: now,
    cycleEnd: addMonths(now, 1),
  };
}

/**
 * Whether a paid subscription is actually in force right now.
 *
 * Access runs to `currentPeriodEnd` whatever the state says, which is the whole
 * of what "cancel" should mean for something already paid for. `PAST_DUE` keeps
 * access too — the card is being retried, and locking somebody out of the
 * documents they are revising from because a bank declined once is how a
 * recoverable payment becomes a cancelled account.
 */
function isEntitled(account: BillingAccount): boolean {
  if (account.tier === "FREE") return false;

  if (account.state === "ACTIVE" || account.state === "TRIALING") return true;
  if (account.state === "PAST_DUE") return true;

  // Cancelled, but paid up until the end of the period.
  return (
    account.state === "CANCELED" &&
    account.currentPeriodEnd !== null &&
    account.currentPeriodEnd > new Date()
  );
}

/** Everything a gate needs, from one read. */
export async function getEntitlements(userId: string): Promise<Entitlements> {
  const account = await ensureAccount(userId);
  const paid = isEntitled(account);

  // A lapsed subscription reads as Free until the webhook tidies the row, so a
  // failed renewal cannot leave somebody on Pro limits indefinitely.
  const tier: PlanTier = paid ? account.tier : "FREE";

  return {
    tier,
    plan: PLANS[tier],
    isPaid: paid,
    endingAt: account.cancelAtPeriodEnd ? account.currentPeriodEnd : null,
    creditsRemaining: account.creditsRemaining,
    creditsGranted: account.creditsGranted,
    renewsAt: account.cycleEnd,
    exhausted: account.creditsRemaining <= 0,
  };
}

/** What a document of this many pages costs to read. */
export function documentCredits(pageCount: number): number {
  return Math.max(
    1,
    Math.ceil(Math.max(1, pageCount) / PAGES_PER_DOCUMENT_CREDIT) *
      CREDIT_COST.DOCUMENT_PER_100_PAGES,
  );
}

/** What transcribing this many scanned pages costs. */
export function ocrCredits(pageCount: number): number {
  return Math.max(1, Math.ceil(Math.max(1, pageCount) / PAGES_PER_OCR_CREDIT));
}

/** What one answer costs, by the tier of model that will write it. */
export function chatCredits(modelTier: ModelTier): number {
  return modelTier === "frontier"
    ? CREDIT_COST.CHAT_FRONTIER
    : CREDIT_COST.CHAT_FAST;
}

/**
 * Takes the credits, or refuses.
 *
 * One statement, and the balance check lives in its `where` clause rather than
 * in a read before it. That is the difference between a meter and a suggestion:
 * two chat turns starting at the same instant with one credit left will both
 * pass a read-then-write check and both be served, whereas exactly one of them
 * updates a row here.
 *
 * Nothing is recorded at this point. The spend is written down by
 * `recordUsage` once the work is actually done, so the ledger describes
 * completed work and the balance describes committed work — which is what makes
 * the refund below honest.
 */
export async function spendCredits({
  userId,
  credits,
}: {
  userId: string;
  credits: number;
}): Promise<void> {
  if (credits <= 0) return;

  await ensureAccount(userId);

  const { count } = await prisma.billingAccount.updateMany({
    where: { userId, creditsRemaining: { gte: credits } },
    data: { creditsRemaining: { decrement: credits } },
  });

  if (count === 0) {
    const account = await prisma.billingAccount.findUnique({
      where: { userId },
      select: { creditsRemaining: true },
    });
    throw new InsufficientCreditsError(credits, account?.creditsRemaining ?? 0);
  }
}

/**
 * Gives back credits taken for work that did not happen.
 *
 * The counterpart to taking them up front, and the reason taking them up front
 * is safe. A model that dies mid-answer, a document that turns out to be
 * unreadable, a run the user stopped before the first token — in every one of
 * those the user has been charged for nothing, and a meter that only ever
 * counts down is one that will be argued with.
 *
 * Deliberately not capped at the granted amount: a refund that lands after the
 * cycle rolled would otherwise be silently dropped, and being a credit up on a
 * broken run is the right side to err on.
 */
export async function refundCredits({
  userId,
  credits,
}: {
  userId: string;
  credits: number;
}): Promise<void> {
  if (credits <= 0) return;

  await prisma.billingAccount.updateMany({
    where: { userId },
    data: { creditsRemaining: { increment: credits } },
  });
}

/**
 * Writes down what was spent, and on what.
 *
 * Never throws. A ledger write that failed a chat turn would mean losing the
 * answer to keep the books, which is the wrong way round — the balance has
 * already moved, and this row exists to explain it, not to authorise it.
 */
export async function recordUsage(event: {
  userId: string;
  kind: UsageKind;
  credits: number;
  provider?: string | null;
  model?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  documentId?: string | null;
  chatId?: string | null;
}): Promise<void> {
  try {
    await prisma.usageEvent.create({ data: event });
  } catch (error) {
    console.error("[billing] could not record usage", { event, error });
  }
}

/**
 * Refuses a feature the plan does not include.
 *
 * Throws rather than returning false, because every caller would otherwise
 * write the same three lines to turn a false into a message — and the message
 * is the part that matters. Each one names the plan that does include it, so a
 * refusal always comes with the way out.
 */
export function requireTier(
  entitlements: Entitlements,
  minimum: PlanTier,
  feature: PlanErrorFeature,
  label: string,
): void {
  if (atLeast(entitlements.tier, minimum)) return;

  throw new PlanLimitError(
    feature,
    `${label} is part of ${PLANS[minimum].name}. You are on ${
      PLANS[entitlements.tier].name
    }.`,
  );
}

/** Which model tier this account's chat should run on. */
export function modelTierFor(
  entitlements: Entitlements,
  /** What the user picked, if the plan lets them pick. */
  preferredProvider?: string | null,
): ModelTier {
  if (!entitlements.plan.providerPicker) return entitlements.plan.defaultModelTier;
  // Picking a provider is what buys the frontier tier; a Pro account that has
  // never touched the picker still gets it, because that is what it pays for.
  return preferredProvider ? "frontier" : entitlements.plan.defaultModelTier;
}
