import { PointerActivationConstraints, PointerSensor } from "@dnd-kit/dom";
import { KeyboardSensor } from "@dnd-kit/react";

/** Marks a subtree that must not start a drag (row action buttons, mostly). */
export const NO_DRAG_ATTRIBUTE = "data-no-drag";

export const driveSensors = [
  PointerSensor.configure({
    // Without an explicit constraint the sensor starts dragging on pointerdown
    // whenever the pointer lands on the drag element, so plain clicks never land.
    // Touch keeps a delay instead of a distance so the page can still scroll.
    activationConstraints: (event) =>
      event.pointerType === "touch"
        ? [new PointerActivationConstraints.Delay({ value: 250, tolerance: 5 })]
        : [new PointerActivationConstraints.Distance({ value: 8 })],

    // The sensor binds natively to the row element, so React's stopPropagation
    // cannot hold it off — opt subtrees out here instead.
    preventActivation: (event) =>
      event.target instanceof Element &&
      event.target.closest(`[${NO_DRAG_ATTRIBUTE}]`) !== null,
  }),
  KeyboardSensor,
];
