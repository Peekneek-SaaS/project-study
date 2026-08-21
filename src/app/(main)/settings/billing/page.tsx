import type { Metadata } from "next";

import { BillingView } from "@/features/billing/views/billing-view";

export const metadata: Metadata = {
  title: "Billing",
};

/**
 * Where a subscription is looked at, and where a checkout comes back to.
 *
 * The return target matters more than it looks: `successUrl` on the checkout
 * points here with `?checkout=complete`, and the page has to be able to say
 * something sensible in the seconds *before* the webhook lands. See
 * `BillingView`, which polls rather than assuming.
 */
const Page = () => {
  return <BillingView />;
};

export default Page;
