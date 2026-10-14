import { Link } from "@heroui/react";
import { useUi } from "../store/ui";

/* An invoice number that opens its pop-up (v3 `.invlink` → openInvoice) */
export function InvoiceLink({ id }: { id: string }) {
  const set = useUi((s) => s.set);
  return (
    <Link className="cursor-pointer font-semibold text-accent" onPress={() => set({ invPop: id, eventPop: null })}>
      {id}
    </Link>
  );
}
export const invLink = (id: string) => <InvoiceLink id={id} />;
