import { Card } from "@heroui/react";
import type { ReactNode } from "react";

/* v3 .blank: a dashed card for "nothing here yet" */
export function EmptyState({ title, children }: { title?: string; children?: ReactNode }) {
  return (
    <Card variant="transparent" className="items-center border border-dashed border-border px-6 py-8 text-center">
      {title && <Card.Title className="text-lg text-vida-navy">{title}</Card.Title>}
      {children && <Card.Description className="text-sm">{children}</Card.Description>}
    </Card>
  );
}
