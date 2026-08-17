import {
  ChatGptIcon,
  ClaudeIcon,
  GoogleGeminiIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { PROVIDER_INFO, type AiProvider } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

/**
 * A provider's mark.
 *
 * Worth having rather than a generic sparkle on every surface: once a
 * conversation can be answered by any of three models — and can quietly fall
 * through to a second when the first is down — "which one said this?" becomes a
 * real question. A logo answers it at a glance, in a transcript where the text
 * is already doing all the other work.
 *
 * From the Hugeicons free set, which ships in this project already, so these are
 * the same stroke weight and grid as every other icon in the app rather than
 * three brand SVGs pasted in at three different optical sizes.
 */
const PROVIDER_ICONS: Record<AiProvider, typeof ChatGptIcon> = {
  openai: ChatGptIcon,
  anthropic: ClaudeIcon,
  google: GoogleGeminiIcon,
};

export function ProviderLogo({
  provider,
  className,
  /**
   * Labelled for screen readers by default, because in a transcript this is
   * genuinely informative. Pass `false` where the name is already written
   * beside it — repeating it just makes the row read twice.
   */
  labelled = true,
}: {
  provider: AiProvider;
  className?: string;
  labelled?: boolean;
}) {
  return (
    <HugeiconsIcon
      icon={PROVIDER_ICONS[provider]}
      // `currentColor` by inheritance: the mark takes the tone of whatever it
      // sits in — muted beside a timestamp, full strength in the picker — so it
      // never competes with the text it is labelling.
      className={cn("size-3.5 shrink-0", className)}
      aria-hidden={!labelled}
      aria-label={labelled ? PROVIDER_INFO[provider].label : undefined}
      role={labelled ? "img" : undefined}
    />
  );
}
