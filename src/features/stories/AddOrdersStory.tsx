import { Button, Card, Chip, Link } from "@heroui/react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ordersOpen } from "../../domain/lines";
import { firstName } from "../../domain/lookup";
import { fmt, round2 } from "../../domain/money";
import { cartItems, catPrice } from "../../domain/payers";
import type { AddStory, Visit } from "../../domain/types";
import { useW } from "../../store/hooks";
import { addOrdersStory, addStoryDo, addStoryOf } from "../../store/payer";
import { useWorld } from "../../store/world";
import { OrderPicker } from "../walkin/OrderPicker";

/* v3 renderAddOrdersStory() (line 2218): choose what is needed, review it, then it is on the visit */
export function AddOrdersStory({ c, top }: { c: Visit; top: ReactNode }) {
  const { t } = useTranslation();
  const w = useW();
  const act = useWorld((s) => s.act);
  const st = addStoryOf(c);
  const items = cartItems(st);
  const total = round2(items.reduce((a, x) => a + catPrice(x), 0));
  const first = firstName(w, c);
  const upd = (fn: (s: AddStory) => void) => act(c.id, (_w, dc) => addStoryDo(dc, fn));

  if (st.stage === 2) return (
    <Card className="gap-3 border-s-4 border-s-accent p-5" data-testid="step-card" data-step="ADD_REVIEW">
      {top}
      <Chip size="sm" variant="soft" color="accent" className="self-start">{t("story.addorders.title")}</Chip>
      <h2 className="text-lg font-bold text-vida-navy" data-testid="step-q">{t("addorders.reviewQ", { count: items.length })}</h2>
      <p className="text-sm text-muted">
        {t("addorders.reviewSub", { first })} · <Link className="cursor-pointer text-sm" onPress={() => upd((s) => { s.stage = 1; })}>{t("addorders.change")}</Link>
      </p>
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border" data-testid="add-review">
        {items.map((x) => (
          <li key={x.code} className="flex items-center gap-3 px-3 py-2">
            <div className="flex-1 leading-tight">
              <b className="block text-sm">{x.name}</b>
              <span className="text-xs text-muted">{x.kind === "package" ? x.children!.join(", ") : x.code}</span>
            </div>
            <span className="text-sm font-semibold tabular-nums">{fmt(catPrice(x))}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-baseline gap-2" data-testid="step-amt">
        <span className="text-2xl font-bold tabular-nums text-danger">{fmt(total)}</span>
        <small className="text-xs text-muted">{t("addorders.patientPays")}</small>
      </div>
      <p className="text-xs text-muted">{t(ordersOpen(c) ? "addorders.hintOpen" : "addorders.hintLater")}</p>
      <div className="flex flex-wrap gap-2" data-testid="step-actions">
        <Button variant="primary" className="bg-success text-success-foreground" onPress={() => act(c.id, addOrdersStory)}>
          {t("addorders.go", { count: items.length })}
        </Button>
      </div>
    </Card>
  );

  return (
    <Card className="gap-3 border-s-4 border-s-accent p-5" data-testid="step-card" data-step="ADD_CHOOSE">
      {top}
      <Chip size="sm" variant="soft" color="accent" className="self-start">{t("story.addorders.title")}</Chip>
      <h2 className="text-lg font-bold text-vida-navy" data-testid="step-q">{t("addorders.q", { first })}</h2>
      <p className="text-sm text-muted">{t("addorders.sub")}</p>
      <OrderPicker cart={st}
        onToggle={(code) => upd((s) => { if (s.sel[code]) delete s.sel[code]; else s.sel[code] = true; })}
        onQuery={(q) => upd((s) => { s.q = q; })} />
      <div className="flex flex-wrap gap-2" data-testid="step-actions">
        <Button variant="primary" isDisabled={!items.length} onPress={() => upd((s) => { s.stage = 2; })}>
          {items.length ? t("addorders.nextN", { count: items.length, total: fmt(total) }) : t("addorders.next")}
        </Button>
      </div>
    </Card>
  );
}
