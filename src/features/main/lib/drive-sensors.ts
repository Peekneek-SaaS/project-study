import { PointerActivationConstraints, PointerSensor } from "@dnd-kit/dom";
import { KeyboardSensor } from "@dnd-kit/react";

/** Marks a subtree that must not start a drag (row action buttons, mostly). */
export const NO_DRAG_ATTRIBUTE = "data-no-drag";

export const driveSensors = [
  PointerSensor.configure({
    // Without an explicit constraint the sensor starts dragging on pointerdown
    // whenever the pointer lands on the drag element, so plain clicks never land.
    activationConstraints: [
      new PointerActivationConstraints.Distance({ value: 8 }),
    ],

    // The sensor binds natively to the row element, so React's stopPropagation
    // cannot hold it off — opt subtrees out here instead.
    //
    // Touch is opted out wholesale: holding a row there selects it (see
    // `useDriveRowInteraction`), and one press cannot mean two things. Moving
    // between folders on a phone goes through the row menu instead.
    preventActivation: (event) =>
      event.pointerType === "touch" ||
      (event.target instanceof Element &&
        event.target.closest(`[${NO_DRAG_ATTRIBUTE}]`) !== null),
  }),
  KeyboardSensor,
];
