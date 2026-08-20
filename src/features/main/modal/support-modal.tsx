"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Modal } from "@/components/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_SUPPORT_TOPIC,
  findSupportTopic,
  MAX_SUPPORT_MESSAGE,
  MAX_SUPPORT_NAME,
  SUPPORT_TOPICS,
  type SupportTopicValue,
} from "@/features/support/lib/support-topics";
import { selectIsOpen, useModalStore } from "@/lib/stores/modal-store";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";

/** The floor the router enforces, repeated so the form can say so first. */
const MIN_SUPPORT_MESSAGE = 10;

/**
 * The Help & Support form, from the sidebar's last row.
 *
 * Sends to the support inbox through `support.send` and keeps nothing: there is
 * no ticket to come back to, so the modal's whole job is to be quick to fill in
 * and honest about whether the message went.
 */
export function SupportModal() {
  const isOpen = useModalStore(selectIsOpen("help-support"));
  const closeModal = useModalStore((state) => state.close);

  const { user } = useUser();

  /*
   * Signed-in details, filled in but not frozen.
   *
   * The person writing this is the person we are logged in as, so asking them
   * to retype what Clerk already knows is a tax on reporting a bug. They stay
   * editable because the reply should be able to go somewhere else - a work
   * address, a colleague chasing the same issue.
   *
   * `null` is "not touched yet", which is why these are not plain strings
   * seeded by an effect. `user` arrives a beat after the first render, and an
   * effect that copied it into state would have to fire on that second render
   * to catch it; deriving instead means the field simply shows the value as
   * soon as there is one. Typing sets the string - including `""`, so a
   * cleared field stays cleared rather than refilling itself - and closing
   * puts it back to `null`, which is what re-prefills for the next visit.
   */
  const [nameInput, setNameInput] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState<string | null>(null);
  const name = nameInput ?? user?.fullName ?? "";
  const email = emailInput ?? user?.primaryEmailAddress?.emailAddress ?? "";

  const [topic, setTopic] = useState<SupportTopicValue>(DEFAULT_SUPPORT_TOPIC);
  const [message, setMessage] = useState("");
  /**
   * Errors are held back until a submit has been attempted. Marking a field
   * invalid before anyone has finished typing in it is noise, and the fields
   * here are short enough that one pass at the end is the whole review.
   */
  const [showErrors, setShowErrors] = useState(false);

  const trpc = useTRPC();

  const sendSupportRequest = useMutation(
    trpc.support.send.mutationOptions({
      onSuccess: () => {
        toast.success("Message sent", {
          description: "We will get back to you by email.",
        });
        handleOpenChange(false);
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const trimmedMessage = message.trim();

  const errors = {
    name: trimmedName ? null : "Tell us your name",
    // Deliberately loose. The address is checked properly on the server, and a
    // strict pattern here only ever turns valid addresses away.
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)
      ? null
      : "That does not look like an email address",
    message:
      trimmedMessage.length >= MIN_SUPPORT_MESSAGE
        ? null
        : "A little more detail helps us help you",
  };

  const isValid = Object.values(errors).every((error) => error === null);

  const handleOpenChange = (open: boolean) => {
    if (open) return;
    setNameInput(null);
    setEmailInput(null);
    setTopic(DEFAULT_SUPPORT_TOPIC);
    setMessage("");
    setShowErrors(false);
    closeModal();
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (sendSupportRequest.isPending) return;

    if (!isValid) {
      setShowErrors(true);
      return;
    }

    sendSupportRequest.mutate({
      name: trimmedName,
      email: trimmedEmail,
      topic,
      message: trimmedMessage,
    });
  };

  const selectedTopic = findSupportTopic(topic);
  const remaining = MAX_SUPPORT_MESSAGE - message.length;

  return (
    <Modal
      open={isOpen}
      onOpenChange={handleOpenChange}
      title="Help and support"
      description="Tell us what is going on and we will reply by email."
      className="sm:max-w-md"
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="support-name"
            label="Name"
            error={showErrors ? errors.name : null}
          >
            <Input
              id="support-name"
              value={name}
              autoFocus
              maxLength={MAX_SUPPORT_NAME}
              placeholder="Your name"
              autoComplete="name"
              aria-invalid={showErrors && errors.name !== null}
              onChange={(event) => setNameInput(event.target.value)}
              className="dark:bg-muted"
            />
          </Field>

          <Field
            id="support-email"
            label="Email"
            error={showErrors ? errors.email : null}
          >
            <Input
              id="support-email"
              type="email"
              value={email}
              maxLength={254}
              placeholder="you@example.com"
              autoComplete="email"
              aria-invalid={showErrors && errors.email !== null}
              onChange={(event) => setEmailInput(event.target.value)}
              className="dark:bg-muted"
            />
          </Field>
        </div>

        <Field
          id="support-topic"
          label="What is this about?"
          hint={selectedTopic.description}
        >
          <Select
            value={topic}
            onValueChange={(next) => setTopic(next as SupportTopicValue)}
          >
            <SelectTrigger id="support-topic" className="w-full dark:bg-muted">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {SUPPORT_TOPICS.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="dark:bg-muted"
                  >
                    <span className="flex items-center gap-2">
                      {/*
                        The same accent the email paints its badge with, so the
                        message that lands in the inbox is recognisably the one
                        that was sent from here.
                      */}
                      <span
                        aria-hidden
                        className="size-2 rounded-full"
                        style={{ backgroundColor: option.accent }}
                      />
                      {option.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <Field
          id="support-message"
          label="Description"
          error={showErrors ? errors.message : null}
        >
          <Textarea
            id="support-message"
            value={message}
            rows={6}
            maxLength={MAX_SUPPORT_MESSAGE}
            placeholder={
              topic === "bug"
                ? "What did you do, what happened, and what did you expect instead?"
                : "As much detail as you can give us."
            }
            aria-invalid={showErrors && errors.message !== null}
            className="min-h-32 dark:bg-muted"
            onChange={(event) => setMessage(event.target.value)}
          />
          {/* Only once it is close enough to matter. */}
          {remaining <= 200 && (
            <p
              className={cn(
                "text-right text-[11px] tabular-nums",
                remaining === 0 ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {remaining} characters left
            </p>
          )}
        </Field>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={sendSupportRequest.isPending}>
            {sendSupportRequest.isPending ? "Sending…" : "Send message"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Label, control, and whichever of hint or error is currently worth saying.
 *
 * The error replaces the hint rather than stacking under it: they occupy the
 * same line, and a form that grows a row taller the moment it is wrong is a
 * form that moves the button out from under the cursor.
 */
function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {(error || hint) && (
        <p
          className={cn(
            "text-[11px] leading-snug",
            error ? "text-destructive-foreground" : "text-muted-foreground",
          )}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
