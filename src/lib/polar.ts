/**
 * No `server-only` marker here, deliberately — see the note in `lib/ai/*`.
 * Nothing in this module survives a client bundle quietly: it is an access
 * token and an HTTP client.
 */

import { Polar } from "@polar-sh/sdk";

import type { BillingPeriod, PlanTier } from "@/generated/prisma/enums";
import { polarProductEnvName } from "@/features/billing/lib/plans";

/**
 * The billing account this app sells through.
 *
 * Two environments, chosen by `POLAR_SERVER` rather than by `NODE_ENV`, and the
 * distinction matters: sandbox and production in Polar are entirely separate
 * worlds — different tokens, different products, different customers — so a
 * staging deployment running production code still needs to point at the
 * sandbox catalogue. Tying it to `NODE_ENV` would make that impossible to say.
 *
 * Defaults to sandbox. A misconfigured deployment that charges nobody is a
 * problem; one that charges real cards by accident is an incident.
 */
export function polarServer(): "sandbox" | "production" {
  return process.env.POLAR_SERVER === "production" ? "production" : "sandbox";
}

let client: Polar | null = null;

/**
 * The SDK client, built once.
 *
 * Lazily, because importing this module must not require the token to be set —
 * the plan catalogue and the pricing page pull in the same tree, and a build
 * that fails at import time for want of a billing secret would take the
 * marketing site down with it.
 */
export function polar(): Polar {
  if (client) return client;

  const accessToken = process.env.POLAR_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error(
      "POLAR_ACCESS_TOKEN is not set. Create an organization access token in " +
        "the Polar dashboard (Settings → Developers) for the environment named " +
        "by POLAR_SERVER.",
    );
  }

  client = new Polar({ accessToken, server: polarServer() });
  return client;
}

/**
 * The product id for a plan, from the environment.
 *
 * Four products, four variables. Read at call time rather than at import, so a
 * missing one is an error on the checkout somebody just clicked — with the name
 * of the variable to set in it — rather than a crash on boot that takes out
 * every page including the ones that do not sell anything.
 */
export function productIdFor(tier: PlanTier, period: BillingPeriod): string {
  const name = polarProductEnvName(tier, period);
  const id = process.env[name];

  if (!id) {
    throw new Error(
      `${name} is not set. Create the ${tier} ${period.toLowerCase()} product ` +
        `in the Polar dashboard and put its product id in ${name}.`,
    );
  }

  return id;
}

/**
 * Which plan a Polar product id belongs to.
 *
 * The reverse lookup the webhook needs: Polar tells us a subscription is for
 * product `abc123`, and only the environment knows that `abc123` is Study
 * Yearly. Built by scanning the same four variables rather than kept as a
 * second map, so there is no way for the two directions to disagree.
 *
 * Returns null for a product this deployment does not know about — an old
 * price, a one-off, something created in the dashboard and not wired up here.
 * The webhook logs and ignores those rather than guessing a tier.
 */
export function planForProductId(
  productId: string,
): { tier: PlanTier; period: BillingPeriod } | null {
  const tiers: PlanTier[] = ["STUDY", "PRO"];
  const periods: BillingPeriod[] = ["MONTHLY", "YEARLY"];

  for (const tier of tiers) {
    for (const period of periods) {
      if (process.env[polarProductEnvName(tier, period)] === productId) {
        return { tier, period };
      }
    }
  }

  return null;
}
