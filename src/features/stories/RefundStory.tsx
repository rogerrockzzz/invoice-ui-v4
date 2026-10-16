import { Button, Card, Checkbox, Chip, Disclosure, Input, Label, TextField } from "@heroui/react";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { WALLET_DOC } from "../../domain/constants";
import { lineRefundable, onCreditInv, performedOf, refundable, refundedOf, refundState } from "../../domain/lines";
import { firstName, payerName, walletDocsOf } from "../../domain/lookup";
import { fmt } from "../../domain/money";
import { refundCalc, type RefundUi } from "../../domain/refund";
import type { Visit } from "../../domain/types";
import { useW } from "../../store/hooks";
import { openRefund, useUi } from "../../store/ui";
import { InvoiceLink } from "../../ui/InvoiceLink";

const Tag = () => {
  const { t } = useTranslation();
  return <Chip size="sm" variant="soft" color="accent" className="self-start">{t("story.refund.title")}</Chip>;
};
function Row({ id, children, amount, end, tone }: { id: string; children: ReactNode; amount: string; end: ReactNode; tone?: string }) {
  return (
    <li className={`flex items-center gap-3 px-3 py-2 ${tone || ""}`} data-testid="refund-row" data-inv={id}>
      <span className="min-w-0 flex-1 leading-tight"><InvoiceLink id={id} /><span className="block text-xs text-muted">{children}</span></span>
      <b className="tabular-nums">{amount}</b>
      <span className="flex min-w-24 justify-end">{end}</span>
    </li>
  );
}

/* v3 renderRefundStory() (line 2825): the visit's invoices, its refund invoices and its wallet documents; Refund on
   the ones that still hold money not yet performed */
export function RefundStory({ c, top }: { c: Visit; top: ReactNode }) {
  const { t } = useTranslation();
  const w = useW();
  const list = c.invoices, rfds = c.refundInvoices || [], wds = walletDocsOf(w, c);
  const can = list.filter((i) => refundable(w, i));
  return (
    <Card className="gap-3 border-s-4 bg-linear-to-br from-blue-50 to-white border-s-accent p-5" data-testid="step-card" data-step="REFUND_LIST">
      {top}
      <Tag />
      <h2 className="text-lg font-bold text-vida-navy" data-testid="step-q">
        {t("refund.listQ", { count: list.length, rfds: rfds.length ? t("refund.rfds", { count: rfds.length }) : "", wds: wds.length ? t("refund.wds", { count: wds.length }) : "" })}
      </h2>
      <p className="text-sm text-muted">{t("refund.listSub", { rest: can.length ? t("refund.canSome", { count: can.length }) : t("refund.canNone") })}</p>
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
        {list.map((inv) => {
          const ok = refundable(w, inv), st = refundState(inv), r = refundedOf(inv);
          const badge = onCreditInv(inv) ? t("refund.onCredit")
            : st ? t(`invoices.status.${st}`) : inv.rows.every((x) => x.refunded || performedOf(c, x.code)) ? t("refund.performed") : t("refund.nothingLeft");
          return (
            <Row key={inv.id} id={inv.id} amount={fmt(inv.patient - r)} tone={ok ? "" : "opacity-70"}
              end={ok ? <Button size="sm" variant="danger" onPress={() => openRefund(inv.id)}>{t("refund.refund")}</Button>
                : <Chip size="sm" variant="soft" color={onCreditInv(inv) ? "warning" : "default"}>{badge}</Chip>}>
              {inv.at} · {t(inv.scope === "consult" ? "refund.scope.consult" : "refund.scope.orders")} · {inv.rows.map((x) => x.name).join(", ")}
              {inv.via ? ` · ${inv.via}` : ""}
              {st && <> · <b>{t(`invoices.status.${st}`)}{r > 0 ? ` ${fmt(r)}` : ""}</b></>}
            </Row>
          );
        })}
        {rfds.map((x) => (
          <Row key={x.id} id={x.id} amount={`−${fmt(x.patient)}`} tone="bg-danger/5"
            end={<Chip size="sm" variant="soft" color="danger">{t("refund.refund")}</Chip>}>
            {x.at} · {t("refund.refundOf", { id: x.refOf })} · {x.rows.map((r) => r.name).join(", ") || x.reason} · {x.via}
          </Row>
        ))}
        {wds.map((d) => {
          const ty = WALLET_DOC[d.wtype]!;
          return (
            <Row key={d.id} id={d.id} amount={`${ty.sign < 0 ? "−" : "+"}${fmt(d.amount)}`}
              end={<Chip size="sm" variant="soft" color={ty.acct === "Credit" ? "warning" : "accent"}>{t(`walletDoc.acct.${ty.acct}`)}</Chip>}>
              {d.at} · {t(`walletDoc.label.${d.wtype}`)}{d.invoiceId ? ` · ${d.invoiceId}` : d.cat ? ` · ${t("refund.advance", { cat: d.cat })}` : ""}{d.mode ? ` · ${d.mode}` : ""}
            </Row>
          );
        })}
      </ul>
    </Card>
  );
}

/* v3 renderRefundWork() (line 5277): stage 2 — what goes back and why, the lines folded underneath; the mode is
   chosen in the slide-in */
export function RefundWork({ c, d, top }: { c: Visit; d: RefundUi; top: ReactNode }) {
  const { t } = useTranslation();
  const w = useW();
  const { upd, openDrawer } = useUi();
  const r = refundCalc(w, d);
  if (!r) return null;
  const { inv, chosen, amt, payerBack, dedBack, open } = r;
  const set = (fn: (x: RefundUi) => void) => upd((s) => { if (s.refund) fn(s.refund); });
  const go = () => {
    if (!r.ok) return;
    openDrawer(c.id, c.mrn, amt, { refund: { id: inv.id, codes: chosen.map((x) => x.code), reason: d.reason.trim(), dedBack } });
  };
  return (
    <Card className="gap-3 border-s-4 bg-linear-to-br from-blue-50 to-white border-s-danger p-5" data-testid="step-card" data-step="REFUND_WORK">
      {top}
      <Tag />
      <h2 className="text-lg font-bold text-vida-navy" data-testid="step-q">{t("refund.workQ", { first: firstName(w, c), inv: inv.id })}</h2>
      <p className="text-sm text-muted">{t("refund.workSub", { at: inv.at, via: inv.via, already: refundedOf(inv) > 0 ? t("refund.already", { amount: fmt(refundedOf(inv)) }) : "" })}</p>
      <div className="flex flex-col gap-0.5" data-testid="refund-amt">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums text-danger" data-testid="refund-amount">{fmt(amt)}</span>
          <small className="text-xs text-muted">{t("refund.amtLabel", { chosen: chosen.length, open })}</small>
        </div>
        {(payerBack > 0 || dedBack > 0) && (
          <span className="text-xs text-muted">
            {[payerBack > 0 ? t("refund.payerBack", { payer: payerName(w, c), amount: fmt(payerBack) }) : "", dedBack > 0 ? t("refund.dedBack", { amount: fmt(dedBack) }) : ""].filter(Boolean).join(" · ")}
          </span>
        )}
      </div>
      <TextField value={d.reason} onChange={(v) => set((x) => { x.reason = v; })} isRequired className="max-w-md">
        <Label>{t("refund.reason")}</Label>
        <Input placeholder={t("refund.reasonPh")} />
      </TextField>
      <div className="flex flex-wrap gap-2" data-testid="step-actions">
        <Button variant="danger" isDisabled={!r.ok} onPress={go}>{t("refund.go", { amount: fmt(amt) })}</Button>
        <Button variant="ghost" onPress={() => upd((s) => { s.refund = null; })}>{t("refund.another")}</Button>
      </div>
      <Disclosure isExpanded={d.linesOpen} onExpandedChange={(o) => set((x) => { x.linesOpen = o; })} className="rounded-xl border border-border">
        <Disclosure.Heading>
          <Disclosure.Trigger className="flex w-full items-center justify-start gap-2 px-3 py-2 text-start text-sm font-semibold text-vida-navy">
            {t("refund.lines", { chosen: chosen.length, open })}
            <Disclosure.Indicator className="ms-2"><ChevronDown className="size-4" /></Disclosure.Indicator>
          </Disclosure.Trigger>
        </Disclosure.Heading>
        <Disclosure.Content>
          {d.linesOpen && (
            <ul className="flex flex-col divide-y divide-border border-t border-border" data-testid="refund-lines">
              {inv.rows.map((x) => {
                const gone = !lineRefundable(w, inv, x); /* refunded, performed or claimed: shown, not refundable */
                const on = !!d.sel[x.code] && !gone;
                const pf = performedOf(c, x.code);
                return (
                  <li key={x.code} className={`flex items-center gap-3 px-3 py-2 ${on ? "bg-danger/5" : ""} ${gone ? "opacity-60" : ""}`} data-testid="refund-line" data-code={x.code}>
                    <Checkbox isSelected={on} isDisabled={gone} aria-label={x.name}
                      onChange={(v) => set((s) => { if (v) s.sel[x.code] = true; else delete s.sel[x.code]; s.linesOpen = true; })}>
                      <Checkbox.Content><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control></Checkbox.Content>
                    </Checkbox>
                    <span className="min-w-0 flex-1 leading-tight">
                      <b className="block text-sm">{x.name}</b>
                      <span className="text-xs text-muted">{x.code}{x.refunded ? t("refund.lineRefunded") : pf ? t("refund.linePerformed") : inv.claimed ? t("refund.lineClaimed")
                        : x.calc.companyWithTax > 0 ? t("refund.linePayer", { amount: fmt(x.calc.companyWithTax) }) : ""}</span>
                    </span>
                    <b className="text-sm tabular-nums">{fmt(x.calc.patientWithTax)}</b>
                    <span className="flex flex-col items-end gap-1">
                      {pf ? <Chip size="sm" variant="soft">{pf !== "seen" ? t("refund.performedAt", { at: pf }) : t("refund.performed")}</Chip>
                        : <Chip size="sm" variant="soft" color="accent">{t("refund.notPerformed")}</Chip>}
                      {inv.claimed && <Chip size="sm" variant="soft" color="warning">{t("refund.claimed")}</Chip>}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Disclosure.Content>
      </Disclosure>
    </Card>
  );
}
