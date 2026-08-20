"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

import { Modal } from "@/components/modal";
import { Button } from "@/components/ui/button";
import { useTodoMutations } from "@/features/todo/hooks/use-todo-mutations";
import {
  selectTodoDeleteSelection,
  useModalStore,
} from "@/lib/stores/modal-store";
import { useTodoSelectionStore } from "@/lib/stores/todo-selection-store";

/**
 * Confirms deleting everything ticked on the todo page.
 *
 * The one delete on this page that asks first, and deliberately the only one: a
 * task deleted from its own menu is a single line somebody wrote in a second
 * and can write again, while this button is pointed at a selection that can run
 * to the whole fortnight — and the tick that put a task into it may have been
 * made minutes and a scroll ago. The cost of the two clicks is paid once; the
 * cost of the other reading is a week of planning gone.
 *
 * The ids arrive on the payload rather than being read from the selection store
 * here, because the page has already reconciled them against what is actually
 * on screen — see `TodoBoard`, where a ticked task that has since been filtered
 * away or deleted elsewhere is dropped before it can ride into the request.
 */
export function DeleteTodosModal() {
  const selection = useModalStore(selectTodoDeleteSelection);
  const closeModal = useModalStore((state) => state.close);
  const clearSelection = useTodoSelectionStore((state) => state.clear);

  const { removeTodos } = useTodoMutations();

  // Closing clears the payload, so the last one is held to keep the count in
  // the title while the dialog animates out instead of blanking mid-transition
  // — the same hold the drive's delete modals keep.
  const [lastSelection, setLastSelection] = useState(selection);
  if (selection && selection !== lastSelection) setLastSelection(selection);
  const items = selection ?? lastSelection;

  const handleOpenChange = (open: boolean) => {
    if (open) return;
    closeModal();
  };

  /**
   * Closed before the write, not after it.
   *
   * `removeTodos` is optimistic — the rows are gone from the list the moment it
   * is called, and it rolls back and toasts for itself if the server refuses —
   * so there is nothing to keep a dialog open for. Holding it there with a
   * "Deleting…" button would be inventing a wait that the rest of this page
   * does not have.
   */
  const handleDelete = () => {
    if (!selection) return;

    closeModal();
    clearSelection();
    void removeTodos(selection.ids);
  };

  if (!items) return null;

  const count = items.ids.length;

  return (
    <Modal
      open={selection !== null}
      onOpenChange={handleOpenChange}
      title={`Delete ${count} ${count === 1 ? "todo" : "todos"}?`}
      icon={Trash2}
      iconClassName="text-destructive"
      description={
        count === 1
          ? "The task is removed from the day it is filed under. This cannot be undone."
          : "The tasks are removed from the days they are filed under. This cannot be undone."
      }
    >
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => handleOpenChange(false)}
        >
          Cancel
        </Button>
        <Button type="button" variant="destructive" onClick={handleDelete}>
          Delete
        </Button>
      </div>
    </Modal>
  );
}
