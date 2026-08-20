import { TRPCError } from "@trpc/server";
import { createHash } from "node:crypto";
import { Resend } from "resend";
import z from "zod";

import { SupportRequestEmail } from "@/components/email/support-request-email";
import {
  findSupportTopic,
  MAX_SUPPORT_MESSAGE,
  MAX_SUPPORT_NAME,
  SUPPORT_TOPIC_VALUES,
} from "@/features/support/lib/support-topics";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Where support mail goes, and who it comes from.
 *
 * Both are overridable so the inbox can move without a code change, and both
 * have defaults so a fresh checkout works with only `RESEND_API_KEY` set.
 *
 * The `from` default is Resend's sandbox sender, which is deliberately limited:
 * it will only deliver to the email on the Resend account. That is enough while
 * `SUPPORT_EMAIL_TO` is that same address - the moment it is not, or the moment
 * this should send from your own domain, verify the domain and set
 * `SUPPORT_EMAIL_FROM`, or every send comes back 403.
 */
const SUPPORT_TO = process.env.SUPPORT_EMAIL_TO ?? "nikatwork365@gmail.com";
const SUPPORT_FROM =
  process.env.SUPPORT_EMAIL_FROM ?? "StudyAI Support <onboarding@resend.dev>";
const SUPPORT_TIMEZONE = process.env.SUPPORT_EMAIL_TIMEZONE ?? "UTC";

const supportRequestSchema = z.object({
  name: z.string().trim().min(1, "Tell us your name").max(MAX_SUPPORT_NAME),
  email: z.email("That does not look like an email address").max(254),
  topic: z.enum(SUPPORT_TOPIC_VALUES),
  message: z
    .string()
    .trim()
    .min(10, "A little more detail helps us help you")
    .max(MAX_SUPPORT_MESSAGE),
});

/**
 * The timestamp the email prints.
 *
 * Formatted here rather than in the template because the template runs wherever
 * Resend renders it and a `Date` formatted there would carry that machine's
 * locale and zone. Formatting on the way in makes the value in the email the
 * one this server decided on, and names the zone so it is never ambiguous.
 */
const formatSubmittedAt = (date: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: SUPPORT_TIMEZONE,
    timeZoneName: "short",
  }).format(date);

/**
 * The plain-text half of the message.
 *
 * Not optional politeness: a multipart message with only an HTML part reads as
 * a spam signal to most filters, and text-only clients would otherwise get
 * whatever the provider decides to synthesise.
 */
const toPlainText = (input: {
  name: string;
  email: string;
  topicLabel: string;
  message: string;
  submittedAt: string;
  userId: string;
}) =>
  [
    `New support request - ${input.topicLabel}`,
    "",
    `Name:      ${input.name}`,
    `Email:     ${input.email}`,
    `Topic:     ${input.topicLabel}`,
    `Submitted: ${input.submittedAt}`,
    `User ID:   ${input.userId}`,
    "",
    "Message",
    "-------",
    input.message,
    "",
    `Reply to this email to answer ${input.name} directly.`,
  ].join("\n");

export const SupportRouter = createTRPCRouter({
  /**
   * Emails one Help & Support submission to the support inbox.
   *
   * Nothing is written to the database: a support request has no life inside
   * the app - it is answered from an inbox - so a table for it would be a copy
   * of the mailbox that nobody reads. If that changes, this is the one place
   * that has the payload.
   */
  send: protectedProcedure
    .input(supportRequestSchema)
    .mutation(async ({ input, ctx }) => {
      const topic = findSupportTopic(input.topic);
      const submittedAt = formatSubmittedAt(new Date());

      /**
       * Same submission, same key - so the retry behind a dropped response, or
       * a second click that beat the pending state, resolves to the original
       * send instead of a duplicate in the inbox. The hash covers the payload
       * because the key must change when the message does: reusing a key with a
       * different body is a 409 from Resend, not a send.
       */
      const fingerprint = createHash("sha256")
        .update([ctx.userId, input.email, input.topic, input.message].join(" "))
        .digest("hex")
        .slice(0, 32);

      const { data, error } = await resend.emails.send(
        {
          from: SUPPORT_FROM,
          to: [SUPPORT_TO],
          // The address typed into the form, so hitting Reply in the inbox
          // answers the person rather than the sending domain.
          replyTo: input.email,
          subject: `[${topic.label}] ${input.name} - StudyAI support`,
          react: SupportRequestEmail({
            name: input.name,
            email: input.email,
            topic: input.topic,
            message: input.message,
            submittedAt,
            userId: ctx.userId,
          }),
          text: toPlainText({
            name: input.name,
            email: input.email,
            topicLabel: topic.label,
            message: input.message,
            submittedAt,
            userId: ctx.userId,
          }),
        },
        { idempotencyKey: `support-request/${fingerprint}` },
      );

      // The Resend SDK resolves rather than throws, so a failed send looks like
      // a success to `await` alone - the error has to be read off the result.
      if (error) {
        console.error("[support] Resend rejected the send", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "We could not send your message. Please try again in a moment.",
        });
      }

      return { id: data?.id ?? null };
    }),
});
