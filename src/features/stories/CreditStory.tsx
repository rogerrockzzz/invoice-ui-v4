import { Button, Card, Chip } from "@heroui/react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { creditInvoices, creditOf } from "../../domain/lines";
import { fmt, round2 } from "../../domain/money";
import type { Visit } from "../../domain/types";
import { useW } from "../../store/hooks";
import { useUi } from "../../store/ui";
import { creditLink, creditSel, toggleCredit } from "../../store/wallet";
import { useWorld } from "../../store/world";
import { CreditList } from "../wallet/WalletSection";

/* v3 renderCreditStory() (line 2970): which invoices is the patient settling — every one starts ticked */
export function CreditStory({ c, top }: { c: Visit; top: ReactNode }) {
  const { t } = useTranslation();
  const w = useW();
  const act = useWorld((s) => s.act);
  const { openDrawer, set } = useUi();
  const who = w.patients[c.mrn]!;
  const list = creditInvoices(w, c.mrn);
  const sel = creditSel(w, c);
  const chosen = list.filter((x) => sel[x.inv.id]);
  const amt = round2(chosen.reduce((a, x) => a + creditOf(x.inv), 0));
  const ids = chosen.map((x) => x.inv.id);
  return (
    <Card className="gap-3 border-s-4 border-s-warning p-5" data-testid="step-card" data-step="CREDIT">
      {top}
      <Chip size="sm" variant="soft" color="warning" className="self-start">{t("story.credit.title")}</Chip>
      <h2 className="text-lg font-bold text-vida-navy" data-testid="step-q">{t("credit.q", { first: who.name.split(" ")[0] })}</h2>
      <p className="text-sm text-muted">{t(list.length > 1 ? "credit.subMany" : "credit.sub", { count: list.length })}</p>
      <CreditList list={list} sel={sel} onToggle={(id, on) => act(c.id, (dw, dc) => toggleCredit(dw, dc, id, on))} onView={(id) => set({ invPop: id })} />
      <div className="flex items-baseline gap-2" data-testid="step-amt">
        <span className="text-2xl font-bold tabular-nums text-danger">{fmt(amt)}</span>
        <small className="text-xs text-muted">{t("credit.selected", { chosen: chosen.length, count: list.length })}</small>
      </div>
      <div className="flex flex-wrap gap-2" data-testid="step-actions">
        <Button variant="primary" className="bg-success text-success-foreground" isDisabled={!amt}
          onPress={() => openDrawer(c.id, c.mrn, amt, { credit: { ids } })}>{t("step.act.takePaymentAtDesk")}</Button>
        <Button variant="outline" isDisabled={!amt} onPress={() => act(c.id, (dw, dc, fx) => creditLink(dw, dc, ids, fx))}>{t("step.act.sendPaymentLink")}</Button>
      </div>
    </Card>
  );
}
