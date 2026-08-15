"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * A select item cannot carry an empty value — Radix reserves it for "nothing
 * picked" — so the reset option travels under a name of its own and is turned
 * back into `null` on the way out.
 */
const ANY = "__any__";

/**
 * Generic in the option type so a filter's values stay their own union all the
 * way through: the callers hand these straight to a typed URL param, and a
 * `string` here would need casting back at every one of them.
 */
interface MainSelectFilterProps<Value extends string> {
  placeholder: string;
  /** `null` when the filter is off, which is what shows the placeholder. */
  value: Value | null;
  onValueChange: (value: Value | null) => void;
  /** Label for the reset option, e.g. "Any type". */
  anyLabel: string;
  values: readonly {
    label: string;
    value: Value;
  }[];
}

const MainSelectFilter = <Value extends string>({
  placeholder,
  values,
  value,
  anyLabel,
  onValueChange,
}: MainSelectFilterProps<Value>) => {
  return (
    <Select
      // Radix shows the placeholder for `""` as well as `undefined`, and the
      // empty string keeps the select controlled where `undefined` would hand
      // it back to Radix the moment the filter is cleared.
      value={value ?? ""}
      onValueChange={(next) =>
        onValueChange(next === ANY ? null : (next as Value))
      }
    >
      <SelectTrigger
        // An active filter is worth seeing from across the toolbar, since it is
        // the reason the listing is short.
        className={cn(
          "h-8 dark:border-muted hover:border-primary",
          value !== null && "border-primary/40 bg-primary/5 text-foreground",
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {values.map((option) => (
            <SelectItem value={option.value} key={option.value}>
              {option.label}
            </SelectItem>
          ))}
          {/* Only offered once there is something to undo. */}
          {value !== null && (
            <>
              <SelectSeparator />
              <SelectItem value={ANY}>{anyLabel}</SelectItem>
            </>
          )}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
};

export default MainSelectFilter;
