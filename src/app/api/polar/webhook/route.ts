import { Webhooks } from "@polar-sh/nextjs";

import { applySubscription, clearSubscription } from "@/features/billing/server/sync";

/**
 * Where Polar tells us what was paid.
 *
 * The only writer of the subscription half of `BillingAccount`, and the only
 * thing in this app that may promote an account to a paid tier. Nothing the
 * browser sends can do that — a checkout returning successfully is a hint that
 * a webhook is coming, not authority to grant anything, which is why the
 * success page polls rather than writes.
 *
 * `Webhooks` verifies the signature against `POLAR_WEBHOOK_SECRET` before any
 * handler runs, and answers a bad signature with a 403 on its own. That check
 * is the entire security model here: this endpoint is public, and without it
 * anyone who knows the URL could post themselves a Pro subscription.
 *
 * Handlers are deliberately idempotent. Polar retries on any non-2xx, events
 * can arrive out of order, and `subscription.created` is routinely followed by
 * `subscription.active` describing the same state — so every one of these
 * writes the world as the payload describes it rather than applying a delta.
 */
export const POST = Webhooks({
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET ?? "",

  /*
    Created, active, updated and uncanceled all mean the same thing to this app:
    here is the current state of a subscription, write it down. They are
    separate hooks in the SDK because they are separate moments in Polar's
    lifecycle, but a handler that treated them differently would be a handler
    that got the order wrong eventually — and the order is not guaranteed.
  */
  onSubscriptionCreated: async ({ data }) => applySubscription(data),
  onSubscriptionActive: async ({ data }) => applySubscription(data),
  onSubscriptionUpdated: async ({ data }) => applySubscription(data),
  onSubscriptionUncanceled: async ({ data }) => applySubscription(data),

  /*
    Cancelled is not revoked, and the difference is the whole of what a customer
    expects from pressing cancel. `subscription.canceled` means "will not renew"
    — access continues to the end of the period they have already paid for, so
    this is still `applySubscription`, which records the end date and the flag.
    `subscription.revoked` is the moment access actually stops.
  */
  onSubscriptionCanceled: async ({ data }) => applySubscription(data),
  onSubscriptionRevoked: async ({ data }) => clearSubscription(data),
});
