"use client";

import { motion } from "motion/react";
import { ArrowRight, CircleSlash, ShieldCheck } from "lucide-react";

import {
  Eyebrow,
  Reveal,
  RevealGroup,
  RevealItem,
  SectionHeading,
} from "@/features/homepage/components/homepage-primitives";
import { FRAME } from "@/features/homepage/lib/design";
import { ProviderLogo } from "@/features/chat/components/provider-logo";
import { AI_PROVIDERS, PROVIDER_INFO } from "@/lib/ai/types";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Three models, and what happens when one of them is having a bad day.
 *
 * The provider list and the descriptions are imported from `@/lib/ai/types`
 * rather than retyped, so this section cannot drift from the picker in the
 * composer — if a fourth model is added to the chain, it appears here on the
 * next build with no one having to remember this file exists.
 *
 * The fallback is the honest headline here. What the picker selects is where
 * the chain *starts*, not the only model allowed to answer, and a user whose
 * pick is down still gets their answer from the next one along. That is a
 * genuinely good property and most tools do not have it, so it is worth a
 * diagram rather than a footnote.
 */
export function ModelsSection() {
  return (
    <section className="border-t border-border">
      <div className={FRAME}>
        <div className="px-5 py-16 sm:px-8 sm:py-24">
          <Reveal>
            <Eyebrow>Models</Eyebrow>
            <SectionHeading
              className="mt-6"
              lead="Three models. Always one that answers."
              rest="Pick the one that suits the question. If it is down, the next picks it up mid-request."
            />
          </Reveal>
        </div>

        <RevealGroup className="grid border-t border-border sm:grid-cols-3">
          {AI_PROVIDERS.map((provider, index) => (
            <RevealItem
              key={provider}
              className={cn(
                "group border-b border-border p-6 transition-colors last:border-b-0 hover:bg-muted/40 sm:border-b-0",
                index < AI_PROVIDERS.length - 1 ? "sm:border-r" : "",
              )}
            >
              <div className="flex items-center gap-2">
                <ProviderLogo
                  provider={provider}
                  className="size-5 text-foreground/70 transition-colors group-hover:text-primary"
                />
                <p className="text-[15px] font-semibold text-foreground">
                  {PROVIDER_INFO[provider].label}
                </p>
              </div>
              <p className="mt-2 text-[13px] text-foreground/45">
                {PROVIDER_INFO[provider].description}
              </p>
              <p className="mt-4 font-mono text-[10px] tracking-[0.1em] text-foreground/25 uppercase">
                Chain position {index + 1}
              </p>
            </RevealItem>
          ))}
        </RevealGroup>

        {/* The failover, drawn */}
        <div className="border-t border-border px-5 py-12 sm:px-8 sm:py-16">
          <Reveal>
            <p className="mb-8 text-center font-mono text-[11px] tracking-[0.14em] text-foreground/35 uppercase">
              When your pick is down
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <FailoverChain />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function FailoverChain() {
  const NODES = [
    {
      label: "Your pick",
      sub: "Claude",
      state: "down" as const,
    },
    {
      label: "Next in chain",
      sub: "Gemini",
      state: "answers" as const,
    },
    {
      label: "You get",
      sub: "the answer",
      state: "done" as const,
    },
  ];

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-stretch gap-3 sm:flex-row sm:items-center">
      {NODES.map((node, index) => (
        <div key={node.label} className="flex flex-1 items-center gap-3">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: DURATION.base, ease: EASE_OUT, delay: index * 0.25 }}
            className={cn(
              "flex flex-1 flex-col gap-1 rounded-none border p-4",
              node.state === "down"
                ? "border-border bg-muted/50"
                : node.state === "answers"
                  ? "border-foreground/20 bg-card"
                  : "border-primary bg-primary/[0.06]",
            )}
          >
            <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.1em] text-foreground/35 uppercase">
              {node.state === "down" ? (
                <CircleSlash className="size-3" />
              ) : node.state === "done" ? (
                <ShieldCheck className="size-3 text-primary" />
              ) : null}
              {node.label}
            </span>
            <span
              className={cn(
                "text-[15px] font-semibold",
                node.state === "down"
                  ? "text-foreground/30 line-through"
                  : node.state === "done"
                    ? "text-primary"
                    : "text-foreground",
              )}
            >
              {node.sub}
            </span>
          </motion.div>

          {index < NODES.length - 1 ? (
            <motion.span
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: DURATION.base, delay: index * 0.25 + 0.15 }}
              className="hidden shrink-0 sm:block"
            >
              <ArrowRight className="size-4 text-foreground/25" />
            </motion.span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
