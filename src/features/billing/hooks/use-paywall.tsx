"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { UpgradeDialog } from "@/features/billing/components/upgrade-dialog";
import { useEntitlements } from "@/features/billing/hooks/use-entitlements";
import { atLeast, PLANS } from "@/features/billing/lib/plans";
import type { PlanTier } from "@/generated/prisma/enums";

/**
 * The one way anything in this app asks "can they, and if not, what now".
 *
 * Two things that are usually built separately and then drift: the *check* and
 * the *offer*. A component that greys out a button has to know which plan
 * includes it; the dialog that opens has to know which plan to recommend; and
 * the server has to agree with both. Here the check returns the answer and
 * opens the right offer, so a feature is gated in one line and there is nowhere
 * for the three to disagree.
 *
 * Nothing here is a security boundary and it is not trying to be. Every gate is
 * enforced again on the server — in the chat task, the document task and the
 * upload route — and this exists so that the refusal arrives as an offer to
 * upgrade rather than as an error after the fact.
 */

/** The things a plan can withhold. Each maps to the tier that first includes it. */
export const GATED_FEATURES = {
  /** Uploading beyond the plan's document limit. */
  documents: { tier: "STUDY", label: "More documents" },
  /** Reading scanned PDFs with a vision model. */
  ocr: { tier: "STUDY", label: "Scanned documents" },
  /** Choosing which provider answers, and with it the frontier models. */
  providerPicker: { tier: "PRO", label: "Model picker" },
  /** Having any credits at all. Not a tier so much as a balance. */
  credits: { tier: "STUDY", label: "More credits" },
} as const satisfies Record<string, { tier: PlanTier; label: string }>;

export type GatedFeature = keyof typeof GATED_FEATURES;

interface PaywallContextValue {
  /** Opens the upgrade dialog, positioned on the plan that unlocks `feature`. */
  open: (feature?: GatedFeature) => void;
}

const PaywallContext = createContext<PaywallContextValue | null>(null);

/**
 * Holds the one upgrade dialog the app has.
 *
 * One dialog at the root rather than one per gate. Twelve components that can
 * each raise a paywall would otherwise mean twelve mounted dialogs, twelve
 * copies of the plan cards, and the possibility of two of them open at once —
 * which is exactly the sort of thing that happens when the fifth gate is added
 * by somebody who has not read the first four.
 */
export function PaywallProvider({ children }: { children: ReactNode }) {
  const [feature, setFeature] = useState<GatedFeature | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback((next?: GatedFeature) => {
    setFeature(next ?? null);
    setIsOpen(true);
  }, []);

  const value = useMemo(() => ({ open }), [open]);

  return (
    <PaywallContext.Provider value={value}>
      {children}
      <UpgradeDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        // What they were reaching for when they hit the wall, so the dialog can
        // lead with the plan that includes it rather than with the cheapest.
        highlight={feature ? GATED_FEATURES[feature].tier : "STUDY"}
        reason={feature}
      />
    </PaywallContext.Provider>
  );
}

/**
 * Whether this account can do something, and how to ask if it cannot.
 *
 * `can` is the question, `require` is the question with the offer attached:
 * it returns false *and* opens the dialog, so the calling site reads as a guard
 * clause rather than as a branch with a side effect buried in it.
 *
 *     const { require } = usePaywall();
 *
 *     const onUpload = () => {
 *       if (!require("documents")) return;
 *       // …
 *     };
 */
export function usePaywall() {
  const context = useContext(PaywallContext);
  const { entitlements, isLoading } = useEntitlements();

  if (!context) {
    throw new Error("usePaywall must be used inside a PaywallProvider.");
  }

  const { open } = context;

  const can = useCallback(
    (feature: GatedFeature): boolean => {
      // Unknown yet. Let them through and let the server be the one to say no —
      // see the note in `useEntitlements`.
      if (!entitlements) return true;

      if (feature === "credits") return entitlements.creditsRemaining > 0;
      if (feature === "ocr") return entitlements.plan.ocr;
      if (feature === "providerPicker") return entitlements.plan.providerPicker;

      return atLeast(entitlements.tier, GATED_FEATURES[feature].tier);
    },
    [entitlements],
  );

  const require = useCallback(
    (feature: GatedFeature): boolean => {
      if (can(feature)) return true;
      open(feature);
      return false;
    },
    [can, open],
  );

  return {
    entitlements,
    isLoading,
    can,
    require,
    /** Opens the dialog with nothing in particular in mind — a plain "Upgrade". */
    open,
    /** The plan a feature needs, for a component that wants to name it. */
    planFor: (feature: GatedFeature) => PLANS[GATED_FEATURES[feature].tier],
  };
}
