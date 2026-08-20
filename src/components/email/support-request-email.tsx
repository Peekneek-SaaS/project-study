import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

import { findSupportTopic } from "@/features/support/lib/support-topics";

/**
 * The theme in `globals.css`, converted to hex.
 *
 * Mail clients do not resolve CSS variables and most reject `oklch()` outright,
 * dropping the declaration and leaving the element unpainted — so the palette
 * has to be literal here. These are the same values, converted once: change one
 * in `globals.css` and change it here too, or the email drifts from the app.
 */
const theme = {
  background: "#F6F5F4",
  card: "#FFFFFF",
  foreground: "#161614",
  secondary: "#565552",
  muted: "#F4F1EF",
  mutedForeground: "#8E8B87",
  border: "#E9E5E0",
  primary: "#D10001",
  primaryForeground: "#FFFFFF",
} as const;

/**
 * Inter first, to match the app, then the stack every client can actually
 * resolve. Webfonts are not loaded — Outlook ignores them and Gmail strips the
 * `@font-face`, so the fallback is what most readers see and it has to be the
 * real choice rather than an afterthought.
 */
const fontFamily =
  "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export interface SupportRequestEmailProps {
  name: string;
  email: string;
  topic: string;
  message: string;
  /** Rendered by the server, not by this component — see `submittedAt` below. */
  submittedAt: string;
  /** Clerk id of the sender, when the form was submitted by a signed-in user. */
  userId?: string;
}

export function SupportRequestEmail({
  name,
  email,
  topic,
  message,
  submittedAt,
  userId,
}: SupportRequestEmailProps) {
  const { label, accent } = findSupportTopic(topic);

  return (
    <Html lang="en">
      <Head />
      {/*
        The inbox line, before anything is opened. Who and what, in that order,
        because the subject already carries the topic and repeating it here
        wastes the only preview a phone shows.
      */}
      <Preview>{`${label} from ${name} — ${firstLine(message)}`}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* The app's primary, as a rule across the top. */}
          <Section style={{ ...styles.accentBar, backgroundColor: accent }} />

          <Section style={styles.header}>
            <table
              cellPadding={0}
              cellSpacing={0}
              role="presentation"
              style={styles.fullWidth}
            >
              <tbody>
                <tr>
                  <td style={styles.markCell}>
                    {/*
                      Drawn rather than linked. An <img> would need a public
                      absolute URL, and every client that blocks remote images
                      by default would show a broken box instead of the logo.
                    */}
                    <div style={styles.mark}>S</div>
                  </td>
                  <td style={styles.wordmarkCell}>
                    <Text style={styles.wordmark}>StudyAI</Text>
                    <Text style={styles.eyebrow}>New support request</Text>
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          <Section style={styles.headline}>
            <span style={{ ...styles.badge, backgroundColor: accent }}>
              {label}
            </span>
            <Heading as="h1" style={styles.title}>
              {name} needs a hand
            </Heading>
          </Section>

          <Section style={styles.details}>
            <DetailRow label="Name" value={name} />
            <DetailRow
              label="Email"
              value={
                <Link href={`mailto:${email}`} style={styles.link}>
                  {email}
                </Link>
              }
            />
            <DetailRow label="Topic" value={label} />
            <DetailRow label="Submitted" value={submittedAt} />
            {userId && <DetailRow label="User ID" value={userId} mono />}
          </Section>

          <Section style={styles.messageSection}>
            <Text style={styles.sectionLabel}>Message</Text>
            <div style={{ ...styles.messagePanel, borderLeftColor: accent }}>
              {toParagraphs(message).map((paragraph, index) => (
                <Text
                  key={index}
                  style={{
                    ...styles.messageText,
                    // Only between paragraphs: a trailing margin on the last
                    // one leaves a gap the panel's own padding already covers.
                    marginBottom: index === 0 ? 0 : undefined,
                    marginTop: index === 0 ? 0 : "12px",
                  }}
                >
                  {withLineBreaks(paragraph)}
                </Text>
              ))}
            </div>
          </Section>

          <Section style={styles.actionSection}>
            {/*
              A table-wrapped anchor rather than <Button>: Outlook collapses the
              padding on a styled <a>, and this is the shape that survives it.
              `Reply` on the message itself works too — the send sets `replyTo`
              to the address above — this is just the one-click version.
            */}
            <table cellPadding={0} cellSpacing={0} role="presentation">
              <tbody>
                <tr>
                  <td style={{ ...styles.buttonCell, backgroundColor: accent }}>
                    <Link
                      href={`mailto:${email}?subject=${encodeURIComponent(
                        `Re: your ${label.toLowerCase()} — StudyAI`,
                      )}`}
                      style={styles.button}
                    >
                      Reply to {firstName(name)}
                    </Link>
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          <Hr style={styles.rule} />

          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              Sent from the Help &amp; Support form in StudyAI. Replying to this
              message goes straight to {email}.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default SupportRequestEmail;

/** One label/value line of the details block. */
function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <table
      cellPadding={0}
      cellSpacing={0}
      role="presentation"
      style={styles.fullWidth}
    >
      <tbody>
        <tr>
          <td style={styles.detailLabelCell}>
            <Text style={styles.detailLabel}>{label}</Text>
          </td>
          <td style={styles.detailValueCell}>
            <Text
              style={{
                ...styles.detailValue,
                ...(mono ? styles.detailValueMono : null),
              }}
            >
              {value}
            </Text>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

/** The first non-empty line, trimmed to fit an inbox preview. */
function firstLine(message: string) {
  const line = message.split("\n").find((part) => part.trim().length > 0) ?? "";
  const trimmed = line.trim();
  return trimmed.length > 120 ? `${trimmed.slice(0, 119)}…` : trimmed;
}

/** "Neeraj Kumar" → "Neeraj", for the button. Falls back to the whole string. */
function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

/**
 * Blank-line-separated blocks, as separate `<Text>` elements.
 *
 * `white-space: pre-wrap` would be the obvious way to keep the sender's shape,
 * but Outlook's rendering engine does not support it and Gmail has been known
 * to strip it — so the paragraphs are made structural instead, which every
 * client understands.
 */
function toParagraphs(message: string) {
  const blocks = message
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  return blocks.length > 0 ? blocks : [message];
}

/** Single newlines inside a paragraph, kept as `<br />`. */
function withLineBreaks(paragraph: string): React.ReactNode[] {
  return paragraph.split("\n").flatMap((line, index) =>
    index === 0 ? [line] : [<br key={index} />, line],
  );
}

const styles = {
  body: {
    margin: 0,
    padding: "32px 12px",
    backgroundColor: theme.background,
    fontFamily,
    // Stops iOS Mail from inflating small text on its own.
    WebkitTextSizeAdjust: "100%",
  },
  container: {
    /*
     * `fontFamily` is repeated on every style that carries text rather than set
     * once on the body, because Outlook renders with Word's engine and Word
     * does not inherit fonts into <table> - and the layout below is tables.
     * Without this, the details block and the button come out in Times New
     * Roman while the rest of the email is Inter.
     */
    fontFamily,
    width: "100%",
    maxWidth: "600px",
    margin: "0 auto",
    backgroundColor: theme.card,
    border: `1px solid ${theme.border}`,
    // `--radius: 0rem` in the app: the corners are square everywhere, and the
    // email matches rather than softening them.
    borderRadius: 0,
  },
  accentBar: { height: "4px", lineHeight: "4px", fontSize: "1px" },
  fullWidth: { width: "100%", borderCollapse: "collapse" as const },
  header: { padding: "28px 32px 0" },
  markCell: { width: "40px", verticalAlign: "top" },
  mark: {
    fontFamily,
    width: "32px",
    height: "32px",
    lineHeight: "32px",
    textAlign: "center" as const,
    backgroundColor: theme.primary,
    color: theme.primaryForeground,
    fontSize: "17px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
  },
  wordmarkCell: { verticalAlign: "top" },
  wordmark: {
    fontFamily,
    margin: 0,
    fontSize: "17px",
    fontWeight: 600,
    letterSpacing: "-0.03em",
    color: theme.foreground,
    lineHeight: "20px",
  },
  eyebrow: {
    fontFamily,
    margin: "2px 0 0",
    fontSize: "11px",
    fontWeight: 500,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    color: theme.mutedForeground,
    lineHeight: "14px",
  },
  headline: { padding: "24px 32px 0" },
  badge: {
    fontFamily,
    display: "inline-block",
    padding: "4px 10px",
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase" as const,
    color: theme.primaryForeground,
  },
  title: {
    fontFamily,
    margin: "14px 0 0",
    fontSize: "24px",
    lineHeight: "30px",
    fontWeight: 600,
    letterSpacing: "-0.03em",
    color: theme.foreground,
  },
  details: {
    padding: "24px 32px 0",
  },
  detailLabelCell: {
    width: "110px",
    verticalAlign: "top",
    padding: "7px 0",
    borderBottom: `1px solid ${theme.border}`,
  },
  detailValueCell: {
    verticalAlign: "top",
    padding: "7px 0",
    borderBottom: `1px solid ${theme.border}`,
  },
  detailLabel: {
    fontFamily,
    margin: 0,
    fontSize: "12px",
    fontWeight: 500,
    letterSpacing: "0.02em",
    color: theme.mutedForeground,
    lineHeight: "20px",
  },
  detailValue: {
    fontFamily,
    margin: 0,
    fontSize: "14px",
    fontWeight: 500,
    color: theme.foreground,
    lineHeight: "20px",
    wordBreak: "break-word" as const,
  },
  detailValueMono: {
    fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
    fontSize: "12px",
    color: theme.secondary,
  },
  link: {
    fontFamily,
    color: theme.primary,
    textDecoration: "none",
    fontWeight: 500,
  },
  messageSection: { padding: "26px 32px 0" },
  sectionLabel: {
    fontFamily,
    margin: "0 0 10px",
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    color: theme.mutedForeground,
    lineHeight: "14px",
  },
  messagePanel: {
    backgroundColor: theme.muted,
    borderLeft: "3px solid",
    padding: "16px 18px",
  },
  messageText: {
    fontFamily,
    margin: 0,
    fontSize: "14px",
    lineHeight: "22px",
    color: theme.foreground,
    wordBreak: "break-word" as const,
  },
  actionSection: { padding: "24px 32px 0" },
  buttonCell: { padding: "11px 20px" },
  button: {
    fontFamily,
    color: theme.primaryForeground,
    fontSize: "14px",
    fontWeight: 600,
    letterSpacing: "-0.01em",
    textDecoration: "none",
    display: "inline-block",
  },
  rule: {
    margin: "28px 0 0",
    border: "none",
    borderTop: `1px solid ${theme.border}`,
  },
  footer: { padding: "16px 32px 28px" },
  footerText: {
    fontFamily,
    margin: 0,
    fontSize: "12px",
    lineHeight: "18px",
    color: theme.mutedForeground,
  },
} as const;
