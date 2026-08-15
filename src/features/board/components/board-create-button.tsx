"use client";

import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCreateBoard } from "@/features/board/hooks/use-create-board";

/** The boards page's way in. What it does lives in `useCreateBoard`. */
export function BoardCreateButton({
  label = "New board",
  variant = "default",
}: {
  label?: string;
  variant?: "default" | "outline";
}) {
  const { createBoard, isPending } = useCreateBoard();

  return (
    <Button variant={variant} onClick={createBoard} disabled={isPending}>
      <PlusIcon />
      {isPending ? "Creating…" : label}
    </Button>
  );
}
