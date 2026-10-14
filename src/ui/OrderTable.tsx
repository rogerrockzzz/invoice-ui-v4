import { Checkbox, Chip, Disclosure, Table, type Selection } from "@heroui/react";
import { ArrowLeftRight, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { planOf } from "../domain/lookup";
import { fmt, round2 } from "../domain/money";
import { calcLine, dedPool, isPending } from "../domain/pricing";
import { nextStep, type NextStep } from "../domain/steps";
import { resolveMsg } from "../i18n/msg";
import type { Line, Visit, World } from "../domain/types";
import { toggleLine } from "../store/actions";
import { useW } from "../store/hooks";
import { useWorld } from "../store/world";
import { M } from "./Rich";

type Ext = NonNullable<NextStep["ext"]>;

/* the approval column, as v3 badges it */
function approval(l: Line): { key: string; color: "success" | "accent" | "warning" | "default" } {
  if (l.urgentCash) return { key: l.approvalPending ? "order.cashOutstanding" : l.approvalGranted ? "order.cashReceived" : "order.billedAsCash", color: "warning" };
  if (l.invoiceId) return { key: "order.alreadyBilled", color: "default" };
  const ins = l.ins || "notinsured";
  return { key: `ins.${ins}`, color: ins === "approved" ? "success" : ins === "partial" ? "accent" : isPending(l) ? "warning" : "default" };
}

/* each line priced on what is left of the deductible pool — only ticked, non-pending lines consume it */
function priceRows(w: World, c: Visit, lines: Line[], pick: boolean) {
  const plan = planOf(w, c);
  let left = dedPool(w, c).left;
  return lines.map((l) => {
    const on = !pick || (c.sel || {})[l.code] !== false;
    const calc = calcLine(l, isPending(l) || !on ? 0 : left, plan);
    if (!isPending(l) && on) left = round2(left - calc.deductible);
    return { l, calc, on };
  });
}

/* v3 orderTable() (line 3819): what is being charged, priced line by line on the running deductible pool;
   a selectable list lets the receptionist drop a line from this charge (at least one stays ticked) */
export function OrderTable({ c, ext }: { c: Visit; ext: Ext }) {
  const { t } = useTranslation();
  const w = useW();
  const act = useWorld((s) => s.act);
  const pick = !!ext.selectable;
  const rows = priceRows(w, c, ext.lines, pick);
  /* an order already on an invoice is history — it is never part of what is being charged now */
  const live = rows.filter((r) => !isPending(r.l) && !r.l.invoiceId);
  const tot = live.filter((r) => r.on).reduce((a, r) => ({ p: a.p + r.calc.patientWithTax, co: a.co + r.calc.companyWithTax }), { p: 0, co: 0 });
  const fixed = rows.filter((r) => isPending(r.l) || r.l.invoiceId).map((r) => r.l.code);

  const onSelect = (keys: Selection) => {
    const now = keys === "all" ? new Set(live.map((r) => r.l.code)) : new Set([...keys].map(String));
    const changed = live.find((r) => r.on !== now.has(r.l.code));
    /* the same lines, as the store's draft holds them */
    if (changed) act(c.id, (dw, dc, fx) => toggleLine(dw, dc, changed.l.code, nextStep(dw, dc).ext?.lines || [], fx));
  };

  return (
    <Disclosure defaultExpanded={!!ext.open} className="mt-4 rounded-xl border border-border">
      <Disclosure.Heading>
        <Disclosure.Trigger className="flex w-full items-center justify-start gap-2 px-3 py-2 text-start text-sm font-semibold text-vida-navy">
          <M msg={ext.title} />
          <Disclosure.Indicator className="ms-auto"><ChevronDown className="size-4" /></Disclosure.Indicator>
        </Disclosure.Trigger>
      </Disclosure.Heading>
      <Disclosure.Content>
        <Table className="rounded-none" data-testid="order-table">
          <Table.ScrollContainer>
            <Table.Content
              aria-label={resolveMsg(t, ext.title)}
              selectionMode={pick ? "multiple" : "none"}
              selectionBehavior="toggle"
              selectedKeys={new Set(rows.filter((r) => r.on && !fixed.includes(r.l.code)).map((r) => r.l.code))}
              disabledKeys={fixed}
              onSelectionChange={onSelect}
            >
              <Table.Header>
                {pick ? <Table.Column className="w-8 pe-0"><span className="sr-only">{t("order.tick")}</span></Table.Column> : null}
                <Table.Column isRowHeader>{t("order.procedure")}</Table.Column>
                <Table.Column>{t("order.approval")}</Table.Column>
                <Table.Column className="text-end">{t("order.price")}</Table.Column>
                <Table.Column className="text-end">{t("order.patientVat")}</Table.Column>
                <Table.Column className="text-end">{t("order.payerVat")}</Table.Column>
              </Table.Header>
              <Table.Body>
                {rows.map(({ l, calc, on }) => {
                  const ap = approval(l);
                  const muted = isPending(l) || !!l.invoiceId || !on;
                  return (
                    <Table.Row key={l.code} id={l.code} data-state={isPending(l) ? "pend" : l.invoiceId ? "done" : !on ? "off" : "on"}>
                      {pick ? (
                        <Table.Cell className="pe-0">
                          {!fixed.includes(l.code) && (
                            <Checkbox aria-label={t("order.tickLine", { name: l.name })} slot="selection" variant="secondary">
                              <Checkbox.Content><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control></Checkbox.Content>
                            </Checkbox>
                          )}
                        </Table.Cell>
                      ) : null}
                      <Table.Cell>
                        <b className={!on ? "text-muted" : ""}>{l.name}</b>
                        <div className="text-[11px] text-muted">
                          {l.code}{l.ordered && ` · ${t("order.ordered", { at: l.ordered })}`}
                          {l.branch && <> · <span className="inline-flex items-center gap-0.5 text-vida-purple" data-testid="branch-tag"><ArrowLeftRight className="size-3" />{l.branch}</span></>}
                          {l.fromPackage && <> · {t("order.fromPackage", { parent: l.fromPackage.parent })}</>}
                        </div>
                        {l.package && l.children && (
                          <div className="mt-1 flex flex-wrap gap-1">{l.children.map((k) => <Chip key={k.code} size="sm" variant="soft">{k.name}</Chip>)}</div>
                        )}
                      </Table.Cell>
                      <Table.Cell><Chip size="sm" variant="soft" color={ap.color}>{t(ap.key)}</Chip></Table.Cell>
                      <Table.Cell className="text-end tabular-nums">{fmt(l.price)}</Table.Cell>
                      <Table.Cell className="text-end font-semibold tabular-nums">
                        {l.invoiceId ? <span className="text-muted">{l.invoiceId}</span> : muted ? "—" : fmt(calc.patientWithTax)}
                      </Table.Cell>
                      <Table.Cell className="text-end tabular-nums">{muted ? "—" : fmt(calc.companyWithTax)}</Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
          <Table.Footer className="flex items-center gap-4 border-t border-border px-3 py-2 text-sm font-semibold">
            <span>{t("order.chargedNow")}</span>
            {pick && <span className="text-xs font-normal text-muted">{t("order.ticked", { on: live.filter((r) => r.on).length, count: live.length })}</span>}
            <span className="ms-auto tabular-nums" data-testid="charged-patient">{fmt(tot.p)}</span>
            <span className="w-28 text-end tabular-nums">{fmt(tot.co)}</span>
          </Table.Footer>
        </Table>
        {ext.note && <p className="px-3 pb-3 text-xs text-muted"><M msg={ext.note} /></p>}
      </Disclosure.Content>
    </Disclosure>
  );
}

