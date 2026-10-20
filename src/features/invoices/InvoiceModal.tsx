import { Button, Chip, Modal, Table } from "@heroui/react";
import { Check, Printer } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { modeLabel, VAT, WALLET_DOC } from "../../domain/constants";
import { ledgerRows } from "../../domain/ledger";
import { performedOf, refundable, refundedOf, refundState } from "../../domain/lines";
import { findInvoice, payerOf, pt } from "../../domain/lookup";
import { fmt } from "../../domain/money";
import type { Invoice, Visit, WalletDoc } from "../../domain/types";
import { visitNo } from "../../domain/visits";
import { useW } from "../../store/hooks";
import { openRefund, useUi } from "../../store/ui";
import { reprint } from "../../store/wallet";
import { useWorld } from "../../store/world";
import { InvoiceLink } from "../../ui/InvoiceLink";

/* v3 reprint() (line 4854): recorded on the visit, a toast — and, in v4, the browser's print of the open document */
export function useReprint() {
  const actW = useWorld((s) => s.actW);
  return (id: string, print = false) => {
    actW((w, fx) => reprint(w, id, fx));
    if (print) window.print();
  };
}

/* v3 renderInvoicePop() (line 5411) and renderWalletDocPop() (line 5375): a printable tax invoice, or the advance /
   credit document a wallet movement produced */
export function InvoiceModal() {
  const w = useW();
  const { invPop, set } = useUi();
  const hit = invPop ? findInvoice(w, invPop) : null;
  const close = () => set({ invPop: null });
  if (!hit) return null;
  const isWallet = (hit.inv as WalletDoc).kind === "wallet";
  return (
    <Modal.Backdrop isOpen onOpenChange={(o) => { if (!o) close(); }}>
      <Modal.Container size="lg">
        <Modal.Dialog aria-label={hit.inv.id} data-print-doc="" className={isWallet ? "sm:max-w-2xl" : "sm:max-w-4xl"}>
          <Modal.CloseTrigger data-print-hide="" />
          {isWallet ? <WalletDocBody c={hit.c} d={hit.inv as WalletDoc} close={close} />
            : (hit.inv as Invoice).kind === "refund" ? <RefundInvoiceBody c={hit.c} inv={hit.inv as Invoice} close={close} />
            : <InvoiceBody c={hit.c} inv={hit.inv as Invoice} close={close} />}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function DocHead({ title, id }: { title: string; id: string }) {
  const { t } = useTranslation();
  const w = useW();
  return (
    <Modal.Header className="flex-row items-start justify-between gap-4 border-b border-border pb-4 pe-10">
      <div>
        <div className="text-base font-bold text-vida-navy">{t("app.group")}</div>
        <div className="text-xs text-muted">{t("app.groupSub")} · {w.settings.branch}</div>
      </div>
      <div className="text-end">
        <Modal.Heading className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</Modal.Heading>
        <div className="text-lg font-bold tabular-nums text-foreground" data-testid="inv-id">{id}</div>
      </div>
    </Modal.Header>
  );
}
function Meta({ rows }: { rows: [string, ReactNode, ReactNode?][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-4 rounded-xl bg-default/40 p-4 text-sm sm:grid-cols-2 md:grid-cols-3">
      {rows.map(([k, b, rest]) => (
        <div key={k} className="min-w-0">
          <dt className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">{k}</dt>
          <dd><b className="block text-foreground">{b}</b>{rest && <span className="block text-xs text-muted">{rest}</span>}</dd>
        </div>
      ))}
    </dl>
  );
}
/* the totals as a short statement under the lines, the patient's share standing out */
function Totals({ rows, note, totalId }: { rows: [string, string, boolean?][]; note: string; totalId?: string }) {
  return (
    <div className="flex w-full flex-col items-end gap-1 px-4 py-3 text-sm" data-testid="inv-totals">
      <dl className="flex w-full max-w-xs flex-col gap-1">
        {rows.map(([k, v, strong]) => (
          <div key={k} className={`flex items-baseline gap-4 ${strong ? "border-t border-border pt-1.5 text-base font-bold text-foreground" : "text-muted"}`}>
            <dt>{k}</dt><dd className={`ms-auto tabular-nums ${strong ? "text-foreground" : ""}`} data-testid={strong ? totalId : undefined}>{v}</dd>
          </div>
        ))}
      </dl>
      <span className="text-[11px] text-muted">{note}</span>
    </div>
  );
}
const money = "whitespace-nowrap text-end tabular-nums";

function InvoiceBody({ c, inv, close }: { c: Visit; inv: Invoice; close: () => void }) {
  const { t } = useTranslation();
  const w = useW();
  const p = pt(w, c);
  const doReprint = useReprint();
  const { upd } = useUi();
  const rows = inv.rows || [];
  const tot = rows.reduce((a, r) => ({ g: a.g + r.calc.gross, d: a.d + r.calc.discount, ded: a.ded + r.calc.deductible, pt: a.pt + r.calc.patientWithTax, co: a.co + r.calc.companyWithTax }),
    { g: 0, d: 0, ded: 0, pt: 0, co: 0 });
  const rs = refundState(inv);
  const pp = inv.packagePrint as { parent: string; invoiceId: string } | undefined;
  const voided = inv.voided as { at: string; reason: string } | undefined;
  const refunds = (inv.refunds || []) as { amount: number; at: string; mode: string; by: string; reason: string; refundInvoiceId?: string }[];
  const meta: [string, ReactNode, ReactNode?][] = [
    [t("invoice.patient"), p.name, `${p.mrn} · ${p.age}/${p.gender} · ${p.mobile}`],
    [t("invoice.visit"), `${c.visitType} · ${c.clinic}`, `Dr ${c.doctor} · ${t("invoice.arrived", { at: c.arrived })}`],
    [t("invoice.payer"), inv.payer || payerOf(w, c).label, t(inv.scope === "consult" ? "event.scopeConsult" : "event.scopeOrders")],
  ];
  if (inv.branch) meta.push([t("invoice.performedAt"), inv.branch, t("invoice.billedAt", { branch: w.settings.branch })]);
  if (pp) meta.push([t("invoice.paidInside"), pp.parent, t("invoice.paidInsideSub", { id: pp.invoiceId })]);
  meta.push([t("invoice.issued"), t("event.today", { at: inv.at }),
    `${inv.paid ? t("invoice.paidBy", { via: inv.via }) : t("invoice.onCredit")}${inv.viaDetail ? ` · ${inv.viaDetail}` : ""}`]);
  return (
    <>
      <DocHead title={t("invoice.tax")} id={inv.id} />
      <Modal.Body className="flex flex-col gap-4" data-testid="inv-doc">
        <Meta rows={meta} />
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label={t("invoice.lines")}>
              <Table.Header>
                <Table.Column isRowHeader className="min-w-56">{t("invoice.description")}</Table.Column>
                <Table.Column className="text-end">{t("invoice.gross")}</Table.Column>
                <Table.Column className="text-end">{t("invoice.disc")}</Table.Column>
                <Table.Column className="text-end">{t("invoice.deductible")}</Table.Column>
                <Table.Column className="text-end">{t("order.patientVat")}</Table.Column>
                <Table.Column className="text-end">{t("order.payerVat")}</Table.Column>
              </Table.Header>
              <Table.Body>
                {rows.map((r) => {
                  const pf = performedOf(c, r.code);
                  return (
                    <Table.Row key={r.code}>
                      <Table.Cell className="align-top">
                        <div className="flex flex-wrap items-center gap-2">
                          <b>{r.name}</b>
                          {r.refunded ? <Chip size="sm" variant="soft" color="danger">{t("invoice.refunded")}</Chip>
                            : pf ? <Chip size="sm" variant="soft" color="success">{t("invoice.performed")}{pf !== "seen" ? ` ${pf}` : ""}</Chip>
                            : <Chip size="sm" variant="soft">{t("invoice.notPerformed")}</Chip>}
                        </div>
                        <div className="text-[11px] text-muted">{r.code}</div>
                        {r.package && r.children && (
                          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label={t("invoice.includes")}>
                            {r.children.map((k) => (
                              <li key={k.code} className="flex items-center gap-1.5 whitespace-nowrap">
                                {k.visitId ? <Check className="size-3 shrink-0 text-success" /> : <span className="size-1 shrink-0 rounded-full bg-current" aria-hidden />}
                                <span>{k.name}{k.visitId ? t("invoice.booked") : ""}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </Table.Cell>
                      <Table.Cell className={`${money} align-top`}>{fmt(r.calc.gross)}</Table.Cell>
                      <Table.Cell className={`${money} align-top`}>{r.calc.discount ? fmt(r.calc.discount) : "—"}</Table.Cell>
                      <Table.Cell className={`${money} align-top`}>{r.calc.deductible ? fmt(r.calc.deductible) : "—"}</Table.Cell>
                      <Table.Cell className={`${money} align-top font-semibold`}>{fmt(r.calc.patientWithTax)}</Table.Cell>
                      <Table.Cell className={`${money} align-top`}>{fmt(r.calc.companyWithTax)}</Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
          <Table.Footer className="w-full p-0">
            <Totals note={t("invoice.vatIncluded", { vat: Math.round(VAT * 100) })} rows={[
              [t("invoice.gross"), fmt(tot.g)],
              ...(tot.d ? [[t("invoice.discount"), `−${fmt(tot.d)}`] as [string, string]] : []),
              ...(tot.ded ? [[t("invoice.deductible"), fmt(tot.ded)] as [string, string]] : []),
              [t("order.payerVat"), fmt(tot.co)],
              [t("order.patientVat"), fmt(tot.pt), true],
            ]} />
          </Table.Footer>
        </Table>
        {refunds.length > 0 && (
          <section className="flex flex-col gap-1 text-sm">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted">{t("invoice.refundsHead")}</h3>
            {refunds.map((r, i) => (
              <div key={i}><b>{fmt(r.amount)}</b> · {r.at} · {r.mode} · {r.by}{r.refundInvoiceId && <> · {t("invoice.refundInvoice")} <InvoiceLink id={r.refundInvoiceId} /></>}
                <span className="block text-xs text-muted">{r.reason}</span></div>
            ))}
          </section>
        )}
        <div className={`flex flex-wrap items-center gap-3 rounded-xl border-s-4 p-4 text-sm ${rs || !inv.paid ? "border-s-warning bg-warning/10" : "border-s-success bg-success/10"}`} data-testid="inv-foot">
          <span className={`font-semibold ${rs || !inv.paid ? "text-warning" : "text-success"}`}>
            {rs ? t("invoice.refundedState", { state: t(`invoices.status.${rs}`), amount: fmt(refundedOf(inv)) })
              : voided ? t("invoice.void", { at: voided.at, reason: voided.reason })
              : pp ? t("invoice.noCharge", { parent: pp.parent })
              : inv.paid ? (inv.settled ? t("invoice.settled", { via: inv.settledVia || inv.via }) : t("invoice.paidInFull", { via: inv.via })) : t("invoice.outstanding")}
          </span>
          {inv.payments && inv.payments.length > 1 && (
            <span className="text-xs text-muted">{inv.payments.map((x) => `${modeLabel(x.mode)} ${fmt(x.amount)}`).join(" + ")}</span>
          )}
          <span className="ms-auto flex items-baseline gap-2">{t(refundedOf(inv) > 0 ? "invoice.netPaid" : "invoice.patientPaid")} <b className="text-lg tabular-nums text-foreground" data-testid="inv-total">{fmt(inv.patient - refundedOf(inv))}</b></span>
        </div>
      </Modal.Body>
      <Modal.Footer className="flex-wrap" data-print-hide="">
        <Button variant="primary" onPress={() => doReprint(inv.id, true)}><Printer className="size-4" />{t("invoice.reprint")}</Button>
        {refundable(w, inv) && (
          <Button variant="danger" onPress={() => openRefund(inv.id)}>{t("invoices.refund")}</Button>
        )}
        <Button variant="outline" onPress={() => upd((s) => { s.invPop = null; s.screen = "invoices"; s.invQ = ""; s.invLoaded = null; })}>{t("event.goInvoices")}</Button>
        <Button variant="secondary" onPress={close}>{t("event.close")}</Button>
      </Modal.Footer>
    </>
  );
}

/* v3 renderRefundInvoicePop() (line 5331): what went back, against which invoice, how and why */
function RefundInvoiceBody({ c, inv, close }: { c: Visit; inv: Invoice; close: () => void }) {
  const { t } = useTranslation();
  const w = useW();
  const p = pt(w, c);
  const doReprint = useReprint();
  const meta: [string, ReactNode, ReactNode?][] = [
    [t("invoice.patient"), p.name, `${p.mrn} · ${p.age}/${p.gender} · ${p.mobile}`],
    [t("invoice.visit"), `${c.visitType} · ${c.clinic}`, `Dr ${c.doctor} · ${visitNo(c)}`],
    [t("refund.doc.of"), <InvoiceLink id={inv.refOf || ""} />, inv.payer],
    [t("refund.doc.refunded"), t("event.today", { at: inv.at }), t("refund.doc.by", { via: inv.via, detail: inv.viaDetail ? ` · ${inv.viaDetail}` : "", by: inv.by })],
    [t("refund.reason"), inv.reason],
  ];
  return (
    <>
      <DocHead title={t("refund.doc.title")} id={inv.id} />
      <Modal.Body className="flex flex-col gap-4" data-testid="inv-doc">
        <Meta rows={meta} />
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label={t("invoice.lines")}>
              <Table.Header>
                <Table.Column isRowHeader className="min-w-60">{t("invoice.description")}</Table.Column>
                <Table.Column className="text-end">{t("invoice.gross")}</Table.Column>
                <Table.Column className="text-end">{t("invoice.deductible")}</Table.Column>
                <Table.Column className="text-end">{t("refund.doc.back")}</Table.Column>
                <Table.Column className="text-end">{t("refund.doc.reversed")}</Table.Column>
              </Table.Header>
              <Table.Body renderEmptyState={() => <span className="text-sm">{t("refund.doc.overpaid")}</span>}>
                {inv.rows.map((r) => (
                  <Table.Row key={r.code}>
                    <Table.Cell><b>{r.name}</b><div className="text-[11px] text-muted">{r.code}</div></Table.Cell>
                    <Table.Cell className={money}>{fmt(r.calc.gross)}</Table.Cell>
                    <Table.Cell className={money}>{r.calc.deductible ? fmt(r.calc.deductible) : "—"}</Table.Cell>
                    <Table.Cell className={`${money} font-semibold`}>−{fmt(r.calc.patientWithTax)}</Table.Cell>
                    <Table.Cell className={money}>{r.calc.companyWithTax ? `−${fmt(r.calc.companyWithTax)}` : "—"}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
          <Table.Footer className="w-full p-0">
            <Totals note={t("invoice.vatIncluded", { vat: Math.round(VAT * 100) })} totalId="inv-total" rows={[
              [t("invoice.deductible"), inv.deductible ? fmt(inv.deductible) : "—"],
              [t("refund.doc.reversed"), inv.company ? `−${fmt(inv.company)}` : "—"],
              [t("refund.doc.back"), `−${fmt(inv.patient)}`, true],
            ]} />
          </Table.Footer>
        </Table>
      </Modal.Body>
      <Modal.Footer data-print-hide="">
        <Button variant="secondary" onPress={close}>{t("event.close")}</Button>
        <Button variant="primary" onPress={() => doReprint(inv.id, true)}><Printer className="size-4" />{t("refund.doc.reprint")}</Button>
      </Modal.Footer>
    </>
  );
}

function WalletDocBody({ d, close }: { c: Visit; d: WalletDoc; close: () => void }) {
  const { t } = useTranslation();
  const w = useW();
  const doReprint = useReprint();
  const p = w.patients[d.mrn]!, ty = WALLET_DOC[d.wtype]!;
  const v = w.cases.find((x) => x.id === d.visitId);
  const after = ledgerRows(w, d.mrn, ty.acct === "Credit" ? "CREDIT" : "ADV").find((r) => r.docId === d.id);
  const meta: [string, ReactNode, ReactNode?][] = [
    [t("invoice.patient"), p.name, `${p.mrn} · ${p.age}/${p.gender} · ${p.mobile}`],
    [t("invoice.visit"), v ? `${v.visitType} · ${v.clinic}` : t("invoices.patientWallet"), v ? `Dr ${v.doctor} · ${visitNo(v)}` : t("invoices.notTied")],
    [t(`walletDoc.label.${d.wtype}`), `${d.date || t("tile.today")} ${d.at}`, `${d.mode ? t("walletDoc.by", { mode: d.mode }) : ""}${d.by}`],
  ];
  if (d.invoiceId) meta.push([t(`walletDoc.against.${d.wtype === "CREDIT_RAISED" || d.wtype === "CREDIT_SETTLED" || d.wtype === "ADV_USED" ? d.wtype : "other"}`), <InvoiceLink id={d.invoiceId} />]);
  if (d.cat) meta.push([t("walletDoc.pot"), t("wallet.pot", { pot: d.cat })]);
  if (d.note) meta.push([t("walletDoc.note"), d.note]);
  return (
    <>
      <DocHead title={t(`walletDoc.title.${d.wtype}`)} id={d.id} />
      <Modal.Body className="flex flex-col gap-4" data-testid="inv-doc">
        <Meta rows={meta} />
        <div className={`flex items-baseline gap-3 rounded-xl p-3 ${ty.acct === "Credit" ? "bg-warning/10" : "bg-accent/10"}`}>
          <span className="text-sm">{t(`walletDoc.label.${d.wtype}`)}</span>
          <b className="ms-auto text-xl tabular-nums" data-testid="inv-total">{ty.sign < 0 ? "−" : "+"}{fmt(d.amount)}</b>
        </div>
        {after && <p className="text-sm text-muted">{t(ty.acct === "Credit" ? "walletDoc.creditAfter" : "walletDoc.advanceAfter")} <b className="text-foreground">{fmt(after.balance)}</b></p>}
      </Modal.Body>
      <Modal.Footer data-print-hide="">
        <Button variant="secondary" onPress={close}>{t("event.close")}</Button>
        <Button variant="primary" onPress={() => doReprint(d.id, true)}><Printer className="size-4" />{t("invoices.reprint")}</Button>
      </Modal.Footer>
    </>
  );
}
