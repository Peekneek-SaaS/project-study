"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ModalProps {
  title: string;
  /** Optional, but strongly preferred: it is the dialog's accessible description. */
  description?: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Titled dialog shell. Owns the chrome so each modal only writes its body.
 *
 * Controlled on purpose — the modals in this app are opened from elsewhere
 * (a toolbar button, an empty state) through `useModalStore`, not by a trigger
 * rendered next to them.
 */
export function Modal({
  title,
  description,
  open,
  onOpenChange,
  children,
  className,
}: ModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={className}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
