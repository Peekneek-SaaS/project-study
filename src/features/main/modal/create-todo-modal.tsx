"use client";

import { useRouter } from "next/navigation";
import { CircleDashed } from "lucide-react";
import { toast } from "sonner";

import { Modal } from "@/components/modal";
import { TodoComposer } from "@/features/todo/components/todo-composer";
import {
  type DayKey,
  dayLabel,
  todayKey,
} from "@/features/todo/lib/todo-dates";
import { todoDatePath } from "@/features/todo/types";
import { selectIsOpen, useModalStore } from "@/lib/stores/modal-store";

/**
 * A task written from anywhere in the app, then followed to its day.
 *
 * The same `TodoComposer` the todo page and the paste picker use, for the same
 * reason the paste picker gives: it is the same decision in all three places —
 * the same three chips, in the same order, through the same optimistic create —
 * and a second implementation would be one to keep in step forever.
 *
 * Opens on today rather than asking which day first, which is the difference
 * between this and the paste picker. A task typed from the create menu is
 * almost always a thing to do now; the date chip is right there for the times
 * it is not, and the redirect follows wherever it was moved to.
 */
export function CreateTodoModal() {
  const isOpen = useModalStore(selectIsOpen("create-todo"));
  const closeModal = useModalStore((state) => state.close);

  const router = useRouter();

  /**
   * Travel to where the task landed, not to the todo page's own idea of where
   * to open: `todoDatePath` names the day, and the page scrolls to that section
   * and flashes it — see `useTodoDayNavigation`. Written from the drive or a
   * board, a task that just vanished into a page you are not on is a task you
   * cannot check was filed the way you meant.
   */
  const handleCreated = (dueDate: DayKey) => {
    closeModal();
    toast.success(`Task added for ${dayLabel(dueDate)}`);
    router.push(todoDatePath(dueDate));
  };

  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) closeModal();
      }}
      title="New task"
      icon={CircleDashed}
      iconClassName="stroke-red-400 stroke-2.5"
      description="Due today unless you say otherwise. You will be taken to the day it lands on."
    >
      {/*
        Keyed on the day so a dialog left open across midnight reopens on the
        new today rather than on the date it was first rendered with — the
        composer only follows `day` while its own date is untouched, and this
        is the cheaper half of that story: a closed dialog has no state worth
        preserving.
      */}
      <TodoComposer
        key={todayKey()}
        day={todayKey()}
        onClose={closeModal}
        onCreated={handleCreated}
        className="rounded-xl"
      />
    </Modal>
  );
}
