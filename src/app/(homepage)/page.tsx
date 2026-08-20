import { HomepageView } from "@/features/homepage/views/homepage-view";

/**
 * The front door.
 *
 * No `metadata` export: the root layout's `default` title and the site
 * description are already exactly what this page wants to say, and a template
 * that produced "StudyAI | StudyAI" would be worse than saying nothing.
 */
const Page = () => {
  return <HomepageView />;
};

export default Page;
