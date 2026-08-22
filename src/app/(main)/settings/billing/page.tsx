"use client";

import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { useSettingsStore } from "@/lib/stores/settings-store";

/**
 * Where a finished checkout lands, and immediately leaves.
 *
 * Usage lives in the settings dialog now, not on a page — but Polar needs a
 * *URL* to return the browser to, and a dialog has none. So this route is the
 * seam between the two: it opens settings on the usage panel and replaces
 * itself with the drive, carrying the `checkout` flag along so the panel knows
 * to say "confirming" while it waits for the webhook.
 *
 * `replace` rather than `push`, so the back button goes wherever the reader was
 * before they went to pay, rather than back into a redirect that bounces them
 * forward again.
 *
 * Keeping the route also means any link anybody has already saved — an email, a
 * receipt, a bookmark — still arrives somewhere sensible instead of at a 404.
 */
const Page = () => {
  const router = useRouter();
  const params = useSearchParams();
  const openSettings = useSettingsStore((state) => state.open);

  const justPaid = params.get("checkout") === "complete";

  useEffect(() => {
    openSettings("usage");
    router.replace(justPaid ? "/main?checkout=complete" : "/main");
  }, [openSettings, router, justPaid]);

  // Briefly on screen while the redirect resolves. It says what is happening
  // rather than flashing an empty page, because for somebody who has just paid
  // this is the most anxious two seconds of the whole flow.
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        {justPaid ? "Confirming your payment…" : "Opening your settings…"}
      </p>
    </div>
  );
};

export default Page;
