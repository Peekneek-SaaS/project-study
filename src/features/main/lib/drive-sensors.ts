import { PointerActivationConstraints, PointerSensor } from "@dnd-kit/dom";
import { KeyboardSensor } from "@dnd-kit/react";

/** Marks a subtree that must not start a drag (row action buttons, mostly). */
export const NO_DRAG_ATTRIBUTE = "data-no-drag";

/**
 * How long a finger has to stay put before the press counts as a hold, and how
 * far it may drift while doing so.
 *
 * Shared with `useDriveRowInteraction` because the same hold does both jobs: it
 * ticks the row and picks it up. If the two disagreed about when it landed, a
 * press could carry a row that was never selected, or tick one the sensor had
 * already given up on.
 */
export const TOUCH_HOLD_MS = 400;
export const TOUCH_HOLD_TOLERANCE_PX = 10;

/** How far a mouse has to travel before a click becomes a drag. */
const POINTER_DRAG_THRESHOLD_PX = 8;

export const driveSensors = [
  PointerSensor.configure({
    // Without an explicit constraint the sensor starts dragging on pointerdown
    // whenever the pointer lands on the drag element, so plain clicks never land.
    //
    // Touch waits for a hold rather than a distance, because on a phone the
    // distance gesture is already taken: a finger that sets off immediately is
    // scrolling the listing. Holding is what says otherwise, and it is the same
    // hold that ticks the row — so a press that ends there leaves a selection,
    // and one that carries on from there drags what it just ticked.
    //
    // Built per press: a constraint holds the state of the gesture it is
    // watching, so sharing one instance across presses would leak it.
    activationConstraints: (event) =>
      event.pointerType === "touch"
        ? [
            new PointerActivationConstraints.Delay({
              value: TOUCH_HOLD_MS,
              tolerance: TOUCH_HOLD_TOLERANCE_PX,
            }),
          ]
        : [
            new PointerActivationConstraints.Distance({
              value: POINTER_DRAG_THRESHOLD_PX,
            }),
          ],

    // The sensor binds natively to the row element, so React's stopPropagation
    // cannot hold it off — opt subtrees out here instead.
    preventActivation: (event) =>
      event.target instanceof Element &&
      event.target.closest(`[${NO_DRAG_ATTRIBUTE}]`) !== null,
  }),
  KeyboardSensor,
];
