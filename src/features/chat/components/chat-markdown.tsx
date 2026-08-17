"use client";

import "katex/dist/katex.min.css";

import { memo } from "react";
import ReactMarkdown, {
  defaultUrlTransform,
  type Components,
} from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import { CitationLink } from "@/features/chat/components/citation-link";
import { isCitationHref, parseCitation } from "@/features/chat/lib/citations";
import { cn } from "@/lib/utils";

/**
 * An answer, rendered.
 *
 * Markdown because the model writes it — headings, lists, tables and code are
 * how an explanation of a chapter is actually shaped, and showing the asterisks
 * instead would be showing the user the machinery.
 *
 * Maths is included for the same reason: this is a study app, and a chemistry
 * or economics document produces answers with formulae in them. Left as raw
 * `$…$` those are unreadable, which would quietly make the app worse at exactly
 * the subjects it should be best at.
 *
 * `memo` is doing real work here. During a stream this component re-renders on
 * every token, and re-parsing the whole answer each time is what makes a long
 * reply stutter as it arrives. Memoised on the text, only the message actually
 * growing pays for its own parse — the ones above it, which are finished, do
 * not re-parse at all.
 */

/**
 * Element overrides.
 *
 * Defined once at module scope rather than inline. A fresh object on every
 * render is a new `components` prop, which defeats the memo above and makes the
 * whole tree reconcile on each token.
 */
const components: Components = {
  /**
   * Two kinds of link, told apart by their scheme.
   *
   * A `doc:` href is a citation the model wrote — see `citations.ts` — and
   * becomes a chip that opens that document at that page. Anything else is a
   * real URL, which opens in a new tab rather than navigating the conversation
   * out from under itself.
   *
   * A malformed citation falls through to the ordinary branch rather than
   * throwing: this is generated text, and a link that renders plainly is a much
   * better failure than an answer that will not render at all.
   */
  a: ({ className, href, children, ...props }) => {
    const citation = parseCitation(href);

    if (citation) {
      return (
        <CitationLink
          documentId={citation.documentId}
          page={citation.page}
        >
          {children}
        </CitationLink>
      );
    }

    return (
      <a
        {...props}
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className={cn("font-medium underline underline-offset-4", className)}
      >
        {children}
      </a>
    );
  },

  // Tables are the one block that can be genuinely wider than the column —
  // comparisons across documents produce them — so this is the one that gets
  // its own scroller rather than being allowed to widen the whole message.
  table: ({ className, ...props }) => (
    <div className="my-3 w-full overflow-x-auto rounded-lg border">
      <table {...props} className={cn("w-full text-sm", className)} />
    </div>
  ),
  th: ({ className, ...props }) => (
    <th
      {...props}
      className={cn(
        "border-b bg-muted/50 px-3 py-2 text-left font-medium",
        className,
      )}
    />
  ),
  td: ({ className, ...props }) => (
    <td {...props} className={cn("border-b px-3 py-2 align-top", className)} />
  ),

  code: ({ className, children, ...props }) => {
    // react-markdown gives fenced blocks a `language-*` class and inline code
    // none, which is the only reliable way to tell them apart here.
    const isBlock = /language-/.test(className ?? "");

    if (isBlock) {
      return (
        <code
          {...props}
          className={cn("block font-mono text-[0.8125rem]", className)}
        >
          {children}
        </code>
      );
    }

    return (
      <code
        {...props}
        className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.8125rem]"
      >
        {children}
      </code>
    );
  },
  pre: ({ className, ...props }) => (
    <pre
      {...props}
      className={cn(
        "my-3 overflow-x-auto rounded-lg border bg-muted/50 p-3",
        className,
      )}
    />
  ),

  // The citation this whole feature exists for usually arrives as a bolded
  // phrase — "According to **Biology, chapter 4, page 5**" — so `strong` is
  // given a little more weight than the surrounding prose.
  strong: ({ className, ...props }) => (
    <strong {...props} className={cn("font-semibold text-foreground", className)} />
  ),
};

const remarkPlugins = [remarkGfm, remarkMath];
const rehypePlugins = [rehypeKatex];

/**
 * Lets citations through the URL sanitiser, and nothing else.
 *
 * react-markdown drops any scheme it does not recognise — which is exactly the
 * behaviour you want against `javascript:` in generated text, and which would
 * also silently blank every `doc:` citation, turning each one into a chip that
 * goes nowhere.
 *
 * So the allowance is narrow and explicit: a href is admitted only if it parses
 * as a real citation, which means an id and an optional page and nothing else.
 * Everything else — including any other invented scheme — is handed back to the
 * default sanitiser untouched.
 */
function urlTransform(url: string): string {
  if (isCitationHref(url)) return url;
  return defaultUrlTransform(url);
}

export const ChatMarkdown = memo(function ChatMarkdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        // Tailwind Typography is not installed, so the rhythm is set here.
        // Deliberately tight: chat answers are read in a narrow column and
        // article-sized spacing makes a three-line reply look like a page.
        "text-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        "[&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-semibold",
        "[&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-[0.9375rem] [&_h2]:font-semibold",
        "[&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:text-sm [&_h3]:font-semibold",
        "[&_p]:my-2",
        "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
        "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
        "[&_li]:my-0.5",
        "[&_blockquote]:my-2 [&_blockquote]:border-s-2 [&_blockquote]:ps-3 [&_blockquote]:text-muted-foreground",
        "[&_hr]:my-4",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={components}
        urlTransform={urlTransform}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
});
