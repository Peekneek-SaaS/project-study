import { auth } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";

/**
 * Streams a document's bytes to whoever is allowed to see them.
 *
 * A proxy rather than a redirect on purpose: redirecting would put the
 * UploadThing URL in the browser's hands, which is the whole thing we are
 * avoiding. The file is fetched server-side and piped straight back, so the
 * client only ever sees this path.
 *
 * Restricted by default — only the owner. There is no sharing yet.
 */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/documents/[documentId]/file">,
) {
  const { documentId } = await ctx.params;
  const { userId } = await auth();

  // 404 rather than 401/403 throughout: whether a document exists is itself
  // something only the owner should be able to learn.
  if (!userId) return new Response("Not found", { status: 404 });

  const doc = await prisma.document.findFirst({
    where: { id: documentId, userId },
    select: { name: true, pdfUrl: true },
  });
  if (!doc) return new Response("Not found", { status: 404 });

  const upstream = await fetch(doc.pdfUrl);
  if (!upstream.ok || !upstream.body) {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers({
    "content-type":
      upstream.headers.get("content-type") ?? "application/octet-stream",
    // RFC 5987 form, so names with non-ASCII characters survive the trip.
    "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(doc.name)}`,
    // Never let a shared cache hold a document it did not authorize.
    "cache-control": "private, no-store",
  });

  // Passed through when known: pdf.js uses it to size its buffer. Notably
  // absent is `accept-ranges` — we do not honour Range requests, and claiming
  // to would have pdf.js ask for slices and get the whole file back each time.
  const length = upstream.headers.get("content-length");
  if (length) headers.set("content-length", length);

  return new Response(upstream.body, { headers });
}
