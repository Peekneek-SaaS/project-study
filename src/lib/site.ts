/**
 * What this app calls itself, in one place.
 *
 * Read by the root metadata and by the Open Graph card that goes out with every
 * shared link, which is the reason it is a module rather than two string
 * literals: a name that appears in a browser tab and a name burned into an
 * image are the same name, and nothing here should be able to say otherwise.
 */

export const SITE_NAME = "StudyAI";

export const SITE_DESCRIPTION =
  "Turn your documents into a workspace: read a PDF, deck or Word file beside a board you can draw on and notes you can keep.";

/**
 * Where this app lives, as an absolute URL.
 *
 * Every URL in a share card has to be absolute — a crawler reading the page has
 * no idea what host a `/opengraph-image` was served from — so `metadataBase`
 * needs a real origin rather than a path.
 *
 * `NEXT_PUBLIC_APP_URL` first, so a custom domain can say so. Vercel's own
 * `VERCEL_PROJECT_PRODUCTION_URL` next: it is the *production* domain on every
 * deployment, which is what a shared link should point at even when the code
 * came from a preview. Localhost last, so `next dev` has a base and the build
 * does not fail for want of one.
 */
export const siteUrl = new URL(
  process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000"),
);

/** The logo's navy, as the share card's ground. Matches `site-logo.png`. */
export const SITE_BRAND_COLOR = "#0b1a52";
