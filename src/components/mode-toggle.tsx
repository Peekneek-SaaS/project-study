"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface ModeToggleProps {
  /**
   * Say which theme is currently chosen, rather than only implying it.
   *
   * Off in a toolbar, where the button is one of a row of icons and the word
   * would be the only text in it. On in settings, where the reader came
   * specifically to find out what this is set to — and where the answer
   * "System" is one the icon alone cannot give, since it can only ever show the
   * theme that choice resolved to.
   */
  themeName?: boolean;
  className?: string;
}

export function ModeToggle({ themeName, className }: ModeToggleProps) {
  // `theme` rather than `resolvedTheme`: this is the *choice*, and "System" is
  // one of the answers. Reading the resolved value would label the button
  // "Dark" for a reader who asked to follow their system and happens to be in
  // the dark half of the day, and then quietly change what they had chosen the
  // moment they touched the menu.
  const { setTheme, theme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={themeName ? "default" : "icon"}
          className={cn("", className)}
        >
          {/*
            The two icons share one grid cell rather than one being taken out of
            the flow with `absolute`. Same crossfade, but the cell is a real box
            of its own: it takes the size the button gives its icons instead of
            a hardcoded one, and the label beside it starts after the icon
            rather than underneath the half of it that had left the flow.
          */}
          <span className="grid shrink-0 place-items-center [&>svg]:col-start-1 [&>svg]:row-start-1">
            <Sun className="scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" />
            <Moon className="scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" />
          </span>
          {themeName ? (
            // `min-w`: the theme is unknown until `next-themes` has read it on
            // the client, so this is empty for the first frame. Holding the
            // width of the longest of the three answers keeps the button from
            // growing under the pointer as it arrives.
            <span className="min-w-10 text-left capitalize">{theme}</span>
          ) : (
            <span className="sr-only">Toggle theme</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
