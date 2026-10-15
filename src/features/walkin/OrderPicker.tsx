import { Label, SearchField, ToggleButton } from "@heroui/react";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ORDER_CATALOG, trendingOrders, type CatalogItem } from "../../domain/constants";
import { fmt } from "../../domain/money";
import { catPrice } from "../../domain/payers";

/* v3 renderOrderPicker() (line 2176): what is trending and needs no doctor first, then search for anything else.
   Anything that needs a doctor's order is shown, but cannot be picked here. */
export function OrderPicker({ cart, onToggle, onQuery }: { cart: { sel: Record<string, boolean>; q: string }; onToggle: (code: string) => void; onQuery: (q: string) => void }) {
  const { t } = useTranslation();
  const q = cart.q.trim().toLowerCase();
  const found = q ? ORDER_CATALOG.filter((x) => x.name.toLowerCase().includes(q) || x.code.toLowerCase().includes(q)) : [];
  const chip = (it: CatalogItem) => {
    const on = !!cart.sel[it.code];
    return (
      <ToggleButton key={it.code} isSelected={on} isDisabled={!it.noDoctor} onChange={() => onToggle(it.code)} data-oc={it.code}
        aria-label={`${it.name} · ${fmt(catPrice(it))}${it.noDoctor ? "" : ` · ${t("picker.needsDoctor")}`}`}
        className="h-auto min-h-11 flex-col items-start gap-0 rounded-xl px-3 py-1.5 text-start">
        <span className="flex items-center gap-1 text-sm font-semibold">{it.name}{on && <Check className="size-3.5" />}</span>
        <span className="text-[11px] font-normal opacity-80">
          {it.kind === "package" ? t("picker.package", { count: it.children!.length }) : t("picker.test")}{it.noDoctor ? "" : ` · ${t("picker.needsDoctorShort")}`}
        </span>
        <span className="text-xs font-semibold tabular-nums">{fmt(catPrice(it))}</span>
      </ToggleButton>
    );
  };
  return (
    <div className="flex flex-col gap-3" data-testid="order-picker">
      <span className="text-[11px] font-bold uppercase tracking-wider text-muted">{t("picker.trending")}</span>
      <div className="flex flex-wrap gap-2">{trendingOrders().map(chip)}</div>
      <SearchField value={cart.q} onChange={onQuery} aria-label={t("picker.search")} className="max-w-md">
        <Label className="sr-only">{t("picker.search")}</Label>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input placeholder={t("picker.search")} />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>
      {q && <div className="flex flex-wrap gap-2">{found.length ? found.map(chip) : <p className="text-sm text-muted">{t("picker.nothing", { q: cart.q })}</p>}</div>}
    </div>
  );
}
