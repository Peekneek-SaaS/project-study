import { AnnouncementBar } from "@/features/homepage/components/announcement-bar";
import { AnswersSection } from "@/features/homepage/components/answers-section";
import { ComprehensionSection } from "@/features/homepage/components/comprehension-section";
import { EverythingSection } from "@/features/homepage/components/everything-section";
import { FinalCtaSection } from "@/features/homepage/components/final-cta-section";
import { FormatsStrip } from "@/features/homepage/components/formats-strip";
import { HeroSection } from "@/features/homepage/components/hero-section";
import { HomepageFooter } from "@/features/homepage/components/homepage-footer";
import { HomepageNav } from "@/features/homepage/components/homepage-nav";
import { ModelsSection } from "@/features/homepage/components/models-section";
import { PipelineSection } from "@/features/homepage/components/pipeline-section";
import { WorkspaceSection } from "@/features/homepage/components/workspace-section";

/**
 * The marketing page, in the order it argues.
 *
 * The sequence is the pitch and is worth reading as one: what it is (hero),
 * what it takes (formats), what you get (workspace), what it does while you
 * are gone (pipeline), what it understood (comprehension), why you should
 * believe the answers (answers), what happens when a model is down (models),
 * everything else (everything), and then the ask.
 *
 * Each band is a client component because each one animates, but this view and
 * the route above it stay on the server — there is no state here, only order,
 * and the page ships less JavaScript for the arrangement being made where no
 * JavaScript is needed to make it.
 *
 * The alternating light/dark rhythm is deliberate and not decorative: the two
 * ink bands fall on `comprehension` and the closing call to action, which are
 * the two moments the page changes what it is talking about. A reader
 * scrolling fast still feels the page turn.
 */
export function HomepageView() {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <AnnouncementBar />
      <HomepageNav />

      <main className="flex-1">
        <HeroSection />
        <FormatsStrip />
        <WorkspaceSection />
        <PipelineSection />
        <ComprehensionSection />
        <AnswersSection />
        <ModelsSection />
        <EverythingSection />
        <FinalCtaSection />
      </main>

      <HomepageFooter />
    </div>
  );
}
