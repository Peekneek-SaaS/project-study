import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { shadcn } from "@clerk/ui/themes";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { ModalProvider } from "@/components/providers/modal-provider";
import { MotionProvider } from "@/components/providers/motion-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from "@/lib/site";
import { TRPCReactProvider } from "@/trpc/client";

const fontSans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fontSerif = Inter({
  subsets: ["latin"],
  variable: "--font-serif",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

/**
 * What every page inherits, and what a shared link shows.
 *
 * The template is what gives a board, a document or the notes list its own name
 * in the tab — each of those pages sets a plain `title` and this wraps it. The
 * `default` is what a page with nothing to say about itself gets, and Next
 * requires one wherever there is a template.
 *
 * `metadataBase` matters more than it looks: the icons and the Open Graph card
 * below are declared as paths, and without a base for them to hang off, Next
 * cannot turn them into the absolute URLs a crawler needs — which is how a link
 * ends up previewing as whatever the scraper found instead of as this app.
 *
 * The icons themselves are files rather than entries here — `icon.png`,
 * `apple-icon.png` and `favicon.ico` beside this file — which is the convention
 * Next picks up on its own.
 */
export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: "/",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full",
        "antialiased",
        fontSerif.variable,
        fontSans.variable,
        "font-sans",
        fontMono.variable,
      )}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ClerkProvider
          appearance={{
            theme: shadcn,
            variables: {
              // The shadcn theme maps Clerk's colours and font weights onto
              // this app's tokens but says nothing about radius, so Clerk keeps
              // its own default of `0.375rem` — which is the curve that shows
              // up against an app sitting at `--radius: 0rem`. Pointing it at
              // the token rather than at a number means the two cannot drift:
              // change the theme's radius and Clerk follows.
              borderRadius: "var(--radius)",
            },
            options: {
              elevation: "flush",
            },
          }}
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <TRPCReactProvider>
              {/*
                Around the modals as well as the page, not just `children`. The
                modals are mounted here rather than beside whatever opens them
                (see `ModalProvider`), so anything inside one — the document
                preview holds a whole viewer, controls and all — would otherwise
                be the one part of the app without a tooltip context.
              */}
              <TooltipProvider>
                {/*
                  Around the modals as well, for the same reason as the tooltips
                  above: a modal is mounted here rather than beside its trigger,
                  and one of them now renders the todo editor — which reads the
                  todo page's filters through `nuqs` to know which cached list
                  its optimistic write belongs to. Outside the adapter that hook
                  throws, so the picker would crash on the step that saves.
                */}
                <NuqsAdapter>
                  <MotionProvider>{children}</MotionProvider>
                  <ModalProvider />
                </NuqsAdapter>
                {/* Above the toaster: uploads started from a modal report into it. */}
                <Toaster position="top-center" />
              </TooltipProvider>
            </TRPCReactProvider>
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
