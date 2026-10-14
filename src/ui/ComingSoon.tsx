import { Tooltip } from "@heroui/react";
import type { ReactNode } from "react";
import { useComingSoon } from "../store/hooks";

/* An entry point that belongs to a later checkpoint or milestone: shown where v3 has it (so the layout
   matches), disabled, and explained on hover / focus. Tooltip.Trigger is itself the focusable control
   (role="button"), so the children must be plain content — never another button. */
export function ComingSoon({ when, label, className, children }: { when: string; label: string; className?: string; children: ReactNode }) {
  const soon = useComingSoon();
  return (
    <Tooltip delay={200}>
      <Tooltip.Trigger aria-label={label} aria-disabled="true" aria-description={soon(when)} className={`cursor-not-allowed opacity-60 ${className || ""}`}>
        {children}
      </Tooltip.Trigger>
      <Tooltip.Content>{soon(when)}</Tooltip.Content>
    </Tooltip>
  );
}
