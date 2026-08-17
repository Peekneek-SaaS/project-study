"use client";

import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProviderLogo } from "@/features/chat/components/provider-logo";
import { AI_PROVIDERS, PROVIDER_INFO, type AiProvider } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

/**
 * Which model answers, chosen from inside the composer.
 *
 * Sat to the left of the send button rather than in a settings page, because it
 * is a decision made *about a question* — "this one is long, give it to
 * Gemini" — and a setting two clicks away would never be used that way.
 *
 * What it selects is where the fallback chain *starts*, not the only model
 * allowed to answer. That distinction is deliberately not explained in the UI:
 * the honest summary is "prefer this one", and a user whose pick was down still
 * gets their answer. The transcript records which model actually spoke.
 */
export function ProviderPicker({
  value,
  onChange,
  disabled,
  className,
}: {
  value: AiProvider;
  onChange: (provider: AiProvider) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={disabled}
          // A quiet control: it sits inside the composer, and a filled button
          // there would compete with the send button next to it.
          className={cn(
            "h-8 gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
            className,
          )}
          aria-label={`Model: ${PROVIDER_INFO[value].label}`}
        >
          {/* The chosen model's own mark rather than a generic sparkle — at
              this size it is the fastest way to read which one is armed, and
              it is the only label left once the text is hidden on narrow
              surfaces like the document panel. */}
          <ProviderLogo provider={value} labelled={false} className="size-5"/>
          {/* <span className="hidden sm:inline">{PROVIDER_INFO[value].label}</span> */}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" side="top" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Answer with
        </DropdownMenuLabel>

        {AI_PROVIDERS.map((provider) => {
          const info = PROVIDER_INFO[provider];
          const isActive = provider === value;

          return (
            <DropdownMenuItem
              key={provider}
              onClick={() => onChange(provider)}
              className="flex items-start gap-2"
            >
              <Check
                className={cn(
                  "mt-0.5 size-3.5 shrink-0",
                  // Held rather than hidden, so the labels do not shift
                  // sideways as the tick moves between rows.
                  isActive ? "opacity-100" : "opacity-0",
                )}
              />
              <span className="flex min-w-0 flex-col">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <ProviderLogo provider={provider} labelled={false} />
                  {info.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {info.description}
                </span>
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
