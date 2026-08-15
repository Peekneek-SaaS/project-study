"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { boardPath } from "@/features/board/types";
import { useTRPC } from "@/trpc/client";

/**
 * Creates a board and opens it.
 *
 * No name is asked for up front: a board is worth more open than named, and it
 * can be renamed from the table once there is something on it. The column
 * default supplies "Untitled Board".
 *
 * A hook rather than a button because the two places this is reachable from
 * look nothing alike — a button on the boards page, a menu item in the drive's
 * create dropdown — while what they do is the same to the last detail.
 */
export function useCreateBoard() {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const create = useMutation(trpc.board.create.mutationOptions());

  const createBoard = async () => {
    try {
      const board = await create.mutateAsync({});
      // Not awaited: the list is behind us now, and the canvas should not wait
      // on a refetch of a table nobody is looking at.
      void queryClient.invalidateQueries(trpc.board.pathFilter());
      router.push(boardPath(board.id));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not create the board",
      );
    }
  };

  return { createBoard, isPending: create.isPending };
}
