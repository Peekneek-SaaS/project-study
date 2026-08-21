import type { BillingPeriod, PlanTier } from "@/generated/prisma/enums";

/**
 * What each plan costs, grants and unlocks — in one place, read by everyone.
 *
 * The marketing page, the paywall, the checkout and the enforcement in the
 * background tasks all read these same objects. That is the entire point of the
 * file: a pricing table that says 250 credits while the server grants 300 is a
 * bug nobody notices until a customer counts, and the only way to be sure they
 * agree is for there to be one of them.
 *
 * Prices are in whole cents, never floats. `9.99 * 100` is `998.9999999999999`
 * in JavaScript, and money that has been through a rounding error is money that
 * will eventually be off by one somewhere a customer can see.
 *
 * The Polar product ids are *not* here — they live in the environment, because
 * sandbox and production have different ones and a deployment should not need a
 * code change to point at a different catalogue. See `polarProductId`.
 */

/** Ordered cheapest to dearest. The order is what makes `atLeast` work. */
export const PLAN_TIERS = ["FREE", "STUDY", "PRO"] as const;

export const BILLING_PERIODS = ["MONTHLY", "YEARLY"] as const;

/**
 * What a credit buys.
 *
 * A single meter across four priced actions, weighted by what each actually
 * costs to serve — a frontier answer is about five times a fast one, and a
 * scanned page is many times a digital one. Weighting them here rather than
 * giving each feature its own allowance means a user who only ever writes and
 * a user who only ever uploads both get a fair deal out of the same number, and
 * there is one balance to explain rather than four.
 */
export const CREDIT_COST = {
  /** One answer from the fast model tier. The default everywhere. */
  CHAT_FAST: 1,
  /** One answer from the frontier tier — the provider picker's models. */
  CHAT_FRONTIER: 5,
  /** Reading and indexing an uploaded document, per 100 pages or part thereof. */
  DOCUMENT_PER_100_PAGES: 2,
  /** Transcribing a scanned page with a vision model, per 5 pages or part. */
  OCR_PER_5_PAGES: 1,
} as const;

/** Pages one document credit covers. Used to price an upload before it runs. */
export const PAGES_PER_DOCUMENT_CREDIT = 100;
export const PAGES_PER_OCR_CREDIT = 5;

/**
 * Which model tier a plan's chat runs on by default.
 *
 * The single largest lever on what this product costs to run: the fast models
 * are around a fifth the price of the frontier ones for the same feature. Free
 * accounts are on fast and cannot change it; paid accounts get the picker, and
 * pay five credits when they use it.
 */
export type ModelTier = "fast" | "frontier";

export interface Plan {
  tier: PlanTier;
  /** What it is called on the pricing page. */
  name: string;
  /** One line, on the card, under the name. */
  tagline: string;
  /** Price in cents, per period. `null` where the plan cannot be bought. */
  price: Record<BillingPeriod, number | null>;
  /** Credits granted at the start of each monthly cycle. */
  monthlyCredits: number;
  /**
   * Credits handed out once, when the account is first seen.
   *
   * Only the free plan has these, and they are what a new account actually
   * runs on: ten credits a month is enough to keep a habit alive and not
   * enough to form one, so the first session gets a larger float. Conversion is
   * decided in that session or not at all.
   */
  welcomeCredits: number;
  /** How many documents may exist at once. */
  documentLimit: number;
  /** How many pages one document may have. */
  pageLimit: number;
  /** Whether scanned documents may be transcribed at all. */
  ocr: boolean;
  /** Whether the provider picker is available, and with it the frontier tier. */
  providerPicker: boolean;
  /** The model tier a plain message runs on. */
  defaultModelTier: ModelTier;
  /** How many tool round trips one answer may take. */
  maxSteps: number;
  /** Shown on the card, in order, ticked. */
  features: string[];
}

/**
 * The catalogue.
 *
 * Yearly is priced at ten months for twelve — the discount is real enough to
 * move people and is funded by the cash arriving a year early, and by the
 * months nobody uses. Annual credits are still granted *monthly* rather than as
 * one enormous yearly pot: a year's worth of credits handed over on day one is
 * a year's worth of cost that can be spent in a week.
 */
export const PLANS: Record<PlanTier, Plan> = {
  FREE: {
    tier: "FREE",
    name: "Free",
    tagline: "Enough to see whether it reads your material properly.",
    price: { MONTHLY: 0, YEARLY: 0 },
    monthlyCredits: 10,
    welcomeCredits: 25,
    documentLimit: 3,
    pageLimit: 150,
    ocr: false,
    providerPicker: false,
    defaultModelTier: "fast",
    maxSteps: 4,
    features: [
      "25 credits to start, then 10 a month",
      "3 documents, up to 150 pages each",
      "Unlimited notes, boards, todos and annotations",
      "Answers cited to the page",
    ],
  },
  STUDY: {
    tier: "STUDY",
    name: "Study",
    tagline: "A term's worth of reading, and the questions that come with it.",
    price: { MONTHLY: 999, YEARLY: 9990 },
    monthlyCredits: 250,
    welcomeCredits: 0,
    documentLimit: 50,
    pageLimit: 3_000,
    ocr: true,
    providerPicker: false,
    defaultModelTier: "fast",
    maxSteps: 6,
    features: [
      "250 credits a month",
      "50 documents, up to 3,000 pages each",
      "Scanned documents read and transcribed",
      "Deeper answers — six searches per question",
      "Everything in Free",
    ],
  },
  PRO: {
    tier: "PRO",
    name: "Pro",
    tagline: "Every model, every document, and the room to go through them.",
    price: { MONTHLY: 2499, YEARLY: 24990 },
    monthlyCredits: 700,
    welcomeCredits: 0,
    documentLimit: 300,
    pageLimit: 20_000,
    ocr: true,
    providerPicker: true,
    defaultModelTier: "frontier",
    maxSteps: 8,
    features: [
      "700 credits a month",
      "300 documents, up to 20,000 pages each",
      "Choose your model — GPT-5, Claude or Gemini",
      "Frontier models by default on every answer",
      "The deepest answers — eight searches per question",
      "Everything in Study",
    ],
  },
};

/** The plans as a list, cheapest first — the order the pricing page shows. */
export const PLAN_LIST: Plan[] = PLAN_TIERS.map((tier) => PLANS[tier]);

/** Whether `tier` is `minimum` or better. The one comparison every gate makes. */
export function atLeast(tier: PlanTier, minimum: PlanTier): boolean {
  return PLAN_TIERS.indexOf(tier) >= PLAN_TIERS.indexOf(minimum);
}

/**
 * The environment variable holding a plan's Polar product id.
 *
 * One per tier and period, e.g. `POLAR_PRODUCT_STUDY_MONTHLY`. Four products in
 * Polar, four variables here, and the sandbox and production deployments differ
 * only in what those variables contain — which is what lets the same build be
 * tested against sandbox and then promoted without touching code.
 */
export function polarProductEnvName(
  tier: PlanTier,
  period: BillingPeriod,
): string {
  return `POLAR_PRODUCT_${tier}_${period}`;
}

/**
 * The price, formatted the way it is shown.
 *
 * Yearly plans are advertised at their monthly equivalent — £8.33 a month,
 * billed yearly — because that is the comparison the reader is actually making
 * against the monthly card beside it. The full charge is shown underneath;
 * hiding it would be the kind of cleverness that arrives as a chargeback.
 */
export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;
}

/** What a yearly plan works out at per month, for the comparison above. */
export function monthlyEquivalent(yearlyCents: number): string {
  return `$${(yearlyCents / 12 / 100).toFixed(2)}`;
}

/** How much a yearly plan saves against paying monthly, as a percentage. */
export function yearlySaving(plan: Plan): number | null {
  const monthly = plan.price.MONTHLY;
  const yearly = plan.price.YEARLY;
  if (!monthly || !yearly) return null;

  return Math.round((1 - yearly / (monthly * 12)) * 100);
}
