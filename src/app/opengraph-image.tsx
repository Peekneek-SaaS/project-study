import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

import { SITE_BRAND_COLOR, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

/**
 * The picture a shared link shows.
 *
 * Drawn here rather than shipped as a flat file so it cannot drift from the
 * name and the description beside it, and so there is one less binary in the
 * repo that nobody can edit.
 *
 * Worth being clear about what this does *not* fix: a page behind a sign-in
 * wall is not readable by the crawler that would use this, and a Vercel
 * deployment with protection turned on hands every crawler Vercel's own login
 * page — complete with Vercel's logo — whatever this file says. The share card
 * for a private page is the sign-in page's card, by design.
 */

export const alt = `${SITE_NAME} — read your documents beside a board and notes`;

export const size = { width: 1200, height: 630 };

export const contentType = "image/png";

export default async function OpengraphImage() {
  /**
   * The mark, inlined.
   *
   * Read off disk rather than linked: the renderer draws this on a server with
   * no idea which host it is answering for, so a `/icon.png` would be a
   * relative URL pointing at nothing. `icon.png` rather than the logo in
   * `public/` because this is the copy that lives inside the traced app
   * directory, and so the copy that is certain to be there at runtime.
   */
  const logo = await readFile(join(process.cwd(), "src/app/icon.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 40,
          padding: 80,
          background: SITE_BRAND_COLOR,
          color: "#ffffff",
          // Only flexbox and a subset of CSS reach this renderer — no grid, and
          // every child of a flex parent needs its own `display`.
          fontFamily: "sans-serif",
        }}
      >
        {/*
          Rounded, so the mark's own light ground reads as a tile on the navy
          rather than as a white box someone forgot to cut out.

          A bare `img` rather than `next/image`: none of this is the DOM. It is
          a drawing instruction for the image renderer, which knows nothing
          about Next's component.
        */}
        <img
          src={logoSrc}
          alt=""
          width={180}
          height={180}
          style={{ borderRadius: 36 }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 20,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 92, fontWeight: 700, letterSpacing: -2 }}>
            {SITE_NAME}
          </div>
          <div
            style={{
              fontSize: 34,
              lineHeight: 1.4,
              color: "rgba(255,255,255,0.75)",
              maxWidth: 820,
            }}
          >
            {SITE_DESCRIPTION}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
