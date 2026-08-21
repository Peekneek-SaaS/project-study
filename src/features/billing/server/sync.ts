/**
 * No `server-only` marker here — see the note in `lib/ai/*`.
 */

import { addMonths } from "date-fns";

import type { Subscription } from "@polar-sh/sdk/models/components/subscription.js";

import type { PlanTier, SubscriptionState } from "@/generated/prisma/enums";
import { PLANS } from "@/features/billing/lib/plans";
import { planForProductId } from "@/lib/polar";
import { prisma } from "@/lib/prisma";

/**
 * Polar's view of a subscription, written into ours.
 *
 * The translation layer, and the only place Polar's vocabulary is allowed to
 * reach. Everything downstream reads `PlanTier` and `SubscriptionState`, so a
 * change at Polar's end — a new status, a renamed interval — is a change to
 * this file and to nothing else.
 */

/**
 * Which user a subscription belongs to.
 *
 * `externalCustomerId` is the Clerk user id, set when the checkout was created.
 * Without it there is no way to know whose subscription this is: Polar's own
 * customer id means nothing to this app until it has been linked, and linking
 * it by email would attach a subscription to whoever happens to share an
 * address with the payer.
 */
function userIdOf(subscription: Subscription): string | null {
  return subscription.customer?.externalId ?? null;
}

/** Polar's status, as the four states this app actually distinguishes. */
function stateOf(subscription: Subscription): SubscriptionState {
  switch (subscription.status) {
    case "active":
      return "ACTIVE";
    case "trialing":
      return "TRIALING";
    case "past_due":
      return "PAST_DUE";
    case "canceled":
      return "CANCELED";
    default:
      // `incomplete`, `incomplete_expired`, `unpaid` — all "not entitled".
      return "INACTIVE";
  }
}

/**
 * Records a subscription as it currently stands.
 *
 * Idempotent by construction: every field is set from the payload, so applying
 * the same event twice, or applying an older event after a newer one, converges
 * on whatever Polar last said rather than compounding.
 *
 * The credit grant is the one part that is *not* idempotent, and it is guarded
 * separately — see `grantCycle`.
 */
export async function applySubscription(subscription: Subscription): Promise<void> {
  const userId = userIdOf(subscription);
  if (!userId) {
    console.error("[polar] subscription with no external customer id", {
      subscriptionId: subscription.id,
    });
    return;
  }

  const plan = planForProductId(subscription.productId);
  if (!plan) {
    console.error("[polar] subscription for an unknown product", {
      subscriptionId: subscription.id,
      productId: subscription.productId,
    });
    return;
  }

  const state = stateOf(subscription);
  const entitled = state === "ACTIVE" || state === "TRIALING" || state === "PAST_DUE";

  await prisma.billingAccount.upsert({
    where: { userId },
    create: {
      userId,
      tier: plan.tier,
      period: plan.period,
      state,
      polarCustomerId: subscription.customerId,
      polarSubscriptionId: subscription.id,
      polarProductId: subscription.productId,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      // A row created by the webhook belongs to somebody who has paid before
      // ever loading a page that would have made one. They start their cycle
      // now, with the plan's allowance.
      creditsRemaining: entitled ? PLANS[plan.tier].monthlyCredits : 0,
      creditsGranted: entitled ? PLANS[plan.tier].monthlyCredits : 0,
      welcomeGranted: true,
      cycleStart: new Date(),
      cycleEnd: addMonths(new Date(), 1),
    },
    update: {
      tier: plan.tier,
      period: plan.period,
      state,
      polarCustomerId: subscription.customerId,
      polarSubscriptionId: subscription.id,
      polarProductId: subscription.productId,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    },
  });

  if (entitled) await grantCycle(userId, plan.tier, subscription.id);
}

/**
 * Tops an account up to its plan's allowance, once per subscription per cycle.
 *
 * The guard is `cycleStart`: a grant only happens if the cycle currently on the
 * row began before this one would. Polar sends several events for the same
 * moment — created, then active, then updated — and each of them arrives here;
 * without the guard, upgrading would hand out three months of credits in the
 * same second.
 *
 * Set rather than incremented. An upgrade mid-cycle should land on the new
 * plan's allowance, not on the old balance plus the new grant — the customer
 * is buying a plan, not a top-up. It also means a downgrade cannot leave
 * somebody spending Pro credits on a Study plan.
 */
async function grantCycle(
  userId: string,
  tier: PlanTier,
  subscriptionId: string,
): Promise<void> {
  const now = new Date();
  const plan = PLANS[tier];

  // One cycle per hour at most, per subscription. The window is what makes the
  // burst of events for a single change collapse into one grant, while a real
  // renewal a month later still lands.
  const cutoff = new Date(now.getTime() - 60 * 60 * 1000);

  const { count } = await prisma.billingAccount.updateMany({
    where: {
      userId,
      polarSubscriptionId: subscriptionId,
      OR: [{ cycleStart: { lt: cutoff } }, { creditsGranted: { not: plan.monthlyCredits } }],
    },
    data: {
      creditsRemaining: plan.monthlyCredits,
      creditsGranted: plan.monthlyCredits,
      cycleStart: now,
      cycleEnd: addMonths(now, 1),
    },
  });

  if (count > 0) {
    console.log("[polar] granted cycle credits", {
      userId,
      tier,
      credits: plan.monthlyCredits,
    });
  }
}

/**
 * Access has actually ended.
 *
 * Back to Free rather than deleted: the row carries the usage history and the
 * Polar ids, which are exactly what somebody asks about when they come back
 * three months later. The credits are set to the free allowance rather than to
 * zero, so a lapsed account is a free account and not a locked one.
 */
export async function clearSubscription(subscription: Subscription): Promise<void> {
  const userId = userIdOf(subscription);
  if (!userId) return;

  const free = PLANS.FREE;
  const now = new Date();

  await prisma.billingAccount.updateMany({
    where: { userId, polarSubscriptionId: subscription.id },
    data: {
      tier: "FREE",
      state: "CANCELED",
      period: null,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: subscription.endsAt ?? subscription.currentPeriodEnd,
      creditsRemaining: free.monthlyCredits,
      creditsGranted: free.monthlyCredits,
      cycleStart: now,
      cycleEnd: addMonths(now, 1),
    },
  });

  console.log("[polar] subscription revoked, account returned to free", { userId });
}
