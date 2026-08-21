import { TRPCError } from "@trpc/server";
import z from "zod";

import { BILLING_PERIODS, PLANS } from "@/features/billing/lib/plans";
import { getEntitlements } from "@/features/billing/server/entitlements";
import { polar, productIdFor } from "@/lib/polar";
import { prisma } from "@/lib/prisma";
import { siteUrl } from "@/lib/site";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

/**
 * Buying, managing and reading a subscription.
 *
 * Checkout is created here rather than through Polar's `Checkout` route
 * adapter, and that is a security decision rather than a stylistic one. The
 * adapter builds a session from query parameters, which means the *browser*
 * says which product to buy and who to bill. Here the product id comes from the
 * environment and the customer id comes from the Clerk session, so the only
 * thing a caller can choose is which of three plans they would like — and there
 * is nowhere in the payload to ask for somebody else's account.
 *
 * Nothing in this router grants anything. It hands back a URL; the entitlement
 * arrives later, from Polar, through the webhook. A client that fakes a
 * successful return gets a page saying "waiting for confirmation" and no
 * credits, which is the correct outcome.
 */

/** Only the plans that can actually be bought. Free is not a checkout. */
const purchasableTier = z.enum(["STUDY", "PRO"]);

export const BillingRouter = createTRPCRouter({
  /**
   * What this account may do right now.
   *
   * The one query the whole UI reads — the paywall, the credit meter, the
   * pricing page's "current plan" marker. Cheap enough to poll and to keep
   * fresh, because it is a single indexed read plus, once a month, a write.
   */
  entitlements: protectedProcedure.query(async ({ ctx }) => {
    const entitlements = await getEntitlements(ctx.userId);

    // The plan object is sent whole so the client never has to look a tier up
    // in a table of its own — which is how a UI ends up claiming a limit the
    // server does not enforce.
    return {
      tier: entitlements.tier,
      plan: entitlements.plan,
      isPaid: entitlements.isPaid,
      endingAt: entitlements.endingAt,
      creditsRemaining: entitlements.creditsRemaining,
      creditsGranted: entitlements.creditsGranted,
      renewsAt: entitlements.renewsAt,
      exhausted: entitlements.exhausted,
    };
  }),

  /**
   * How much of the allowance has gone, and on what.
   *
   * Read by the billing page rather than by every screen, so it is a separate
   * call from `entitlements` — a meter in the sidebar should not be paying for
   * a group-by across the ledger.
   */
  usage: protectedProcedure.query(async ({ ctx }) => {
    const account = await prisma.billingAccount.findUnique({
      where: { userId: ctx.userId },
      select: { cycleStart: true },
    });

    const rows = await prisma.usageEvent.groupBy({
      by: ["kind"],
      where: {
        userId: ctx.userId,
        createdAt: { gte: account?.cycleStart ?? new Date(0) },
      },
      _sum: { credits: true },
      _count: { _all: true },
    });

    return rows.map((row) => ({
      kind: row.kind,
      credits: row._sum.credits ?? 0,
      count: row._count._all,
    }));
  }),

  /**
   * Starts a purchase, and returns where to send the browser.
   *
   * `externalCustomerId` is the whole of the link between Polar and this app:
   * it is what comes back on every webhook, and it is what lets a customer who
   * pays twice, or upgrades, or resubscribes a year later, land on the same
   * account rather than a second one.
   *
   * The metadata is for the humans reading Polar's dashboard rather than for
   * this app, which reads none of it — but a payment that has to be traced at
   * two in the morning is much easier to trace when the row says which tier and
   * period it was meant to be.
   */
  checkout: protectedProcedure
    .input(
      z.object({
        tier: purchasableTier,
        period: z.enum(BILLING_PERIODS),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const checkout = await polar().checkouts.create({
          products: [productIdFor(input.tier, input.period)],
          externalCustomerId: ctx.userId,
          successUrl: new URL(
            "/settings/billing?checkout=complete",
            siteUrl,
          ).toString(),
          metadata: {
            tier: input.tier,
            period: input.period,
            plan: PLANS[input.tier].name,
          },
        });

        return { url: checkout.url };
      } catch (error) {
        // The two likely causes are an unset product id and a token pointing at
        // the wrong environment, and both are deployment mistakes rather than
        // anything the customer did — so they are logged in full and reported
        // as a failure to open checkout rather than as a payment problem.
        console.error("[polar] could not create checkout", { input, error });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Could not open checkout. This is our end, not yours — please try " +
            "again in a moment.",
        });
      }
    }),

  /**
   * A signed link into Polar's own customer portal.
   *
   * Cancelling, changing a card, downloading an invoice and seeing past
   * payments all live there. Building any of that here would mean handling
   * card data and dunning, which is most of the reason to use a merchant of
   * record in the first place.
   *
   * The session is created against the *external* id, so an account that has
   * never had a Polar customer record created for it — somebody who opened the
   * billing page before ever paying — gets a clean failure rather than a portal
   * belonging to nobody.
   */
  portal: protectedProcedure.mutation(async ({ ctx }) => {
    const account = await prisma.billingAccount.findUnique({
      where: { userId: ctx.userId },
      select: { polarCustomerId: true },
    });

    if (!account?.polarCustomerId) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "There is no billing history on this account yet.",
      });
    }

    try {
      const session = await polar().customerSessions.create({
        externalCustomerId: ctx.userId,
      });

      return { url: session.customerPortalUrl };
    } catch (error) {
      console.error("[polar] could not open customer portal", {
        userId: ctx.userId,
        error,
      });

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not open the billing portal. Please try again shortly.",
      });
    }
  }),
});
