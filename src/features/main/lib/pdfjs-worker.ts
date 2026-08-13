import { pdfjs } from "react-pdf";

/**
 * Points pdf.js at its worker, once, for everything that renders a PDF.
 *
 * Resolved through the bundler rather than a CDN, so the worker always matches
 * the `pdfjs-dist` version react-pdf was built against. Importing this module
 * twice is harmless — modules run once — but setting it in two places would
 * eventually mean two versions.
 */
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export { pdfjs };
