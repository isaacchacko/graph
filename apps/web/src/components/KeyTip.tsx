"use client";

import type { ReactNode } from "react";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** A tooltip naming a control and the key that does the same thing. */
export function KeyTip({
  label,
  keys = [],
  side = "bottom",
  children,
}: {
  label: string;
  keys?: string[];
  side?: "top" | "bottom" | "left" | "right";
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} sideOffset={6} className="duration-150 data-closed:duration-100">
        {label}
        {keys.length > 0 && (
          <KbdGroup>
            {keys.map((k) => (
              <Kbd key={k}>{k}</Kbd>
            ))}
          </KbdGroup>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
