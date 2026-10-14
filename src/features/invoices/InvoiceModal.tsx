import { Button, Modal, Table } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { modeLabel, VAT } from "../../domain/constants";
import { findInvoice, payerOf, pt } from "../../domain/lookup";
import { fmt } from "../../domain/money";
import type { Invoice, WalletDoc } from "../../domain/types";
import { useW } from "../../store/hooks";
import { useUi } from "../../store/ui";

/* A minimal, read-only invoice preview (v3 renderInvoicePop, line 5411). The full pop-up — reprint,
   refund, wallet documents, refund invoices — is checkpoint 1c. */
export function InvoiceModal() {
  const { t } = useTranslation();
  const w = useW();
  const { invPop, set } = useUi();
  const hit = invPop ? findInvoice(w, invPop) : null;
  const close = () => set({ invPop: null });
  if (!hit) return null;
  const { c } = hit;
  const p = pt(w, c);
  const doc = hit.inv as WalletDoc;
  const inv = hit.inv as Invoice;
  const isWallet = doc.kind === "wallet";
  const rows = isWallet ? [] : inv.rows || [];
  const tot = rows.reduce((a, r) => ({ g: a.g + r.calc.gross, d: a.d + r.calc.discount, ded: a.ded + r.calc.deductible, pt: a.pt + r.calc.patientWithTax, co: a.co + r.calc.companyWithTax }),
    { g: 0, d: 0, ded: 0, pt: 0, co: 0 });

  return (
    <Modal.Backdrop isOpen onOpenChange={(o) => { if (!o) close(); }}>
      <Modal.Container size="lg">
        <Modal.Dialog aria-label={inv.id}>
          <Modal.CloseTrigger />
          <Modal.Header className="flex-row items-start justify-between gap-4">
            <div>
              <div className="text-sm font-bold text-vida-navy">{t("app.group")}</div>
              <div className="text-xs text-muted">{t("app.groupSub")} · {w.settings.branch}</div>
            </div>
            <div className="text-end">
              <Modal.Heading className="text-sm">{t(isWallet ? "invoice.walletDoc" : "invoice.tax")}</Modal.Heading>
              <div className="text-xs font-semibold" data-testid="inv-id">{inv.id}</div>
            </div>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4" data-testid="inv-doc">
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
              <dt className="text-muted">{t("invoice.patient")}</dt><dd><b>{p.name}</b> · {p.mrn} · {p.age}/{p.gender} · {p.mobile}</dd>
              <dt className="text-muted">{t("invoice.visit")}</dt><dd><b>{c.visitType} · {c.clinic}</b> · Dr {c.doctor} · {t("invoice.arrived", { at: c.arrived })}</dd>
              {!isWallet && <><dt className="text-muted">{t("invoice.payer")}</dt><dd><b>{inv.payer || payerOf(w, c).label}</b> · {t(inv.scope === "consult" ? "event.scopeConsult" : "event.scopeOrders")}</dd></>}
              {inv.branch && <><dt className="text-muted">{t("invoice.performedAt")}</dt><dd><b>{inv.branch}</b> · {t("invoice.billedAt", { branch: w.settings.branch })}</dd></>}
              <dt className="text-muted">{t("invoice.issued")}</dt>
              <dd>
                <b>{t("event.today", { at: inv.at })}</b>
                {isWallet ? ` · ${doc.note}` : ` · ${inv.paid ? t("invoice.paidBy", { via: inv.via }) : t("invoice.onCredit")}${inv.viaDetail ? ` · ${inv.viaDetail}` : ""}`}
              </dd>
            </dl>
            {!isWallet && (
              <Table>
                <Table.ScrollContainer>
                  <Table.Content aria-label={t("invoice.lines")}>
                    <Table.Header>
                      <Table.Column isRowHeader>{t("invoice.description")}</Table.Column>
                      <Table.Column className="text-end">{t("invoice.gross")}</Table.Column>
                      <Table.Column className="text-end">{t("invoice.disc")}</Table.Column>
                      <Table.Column className="text-end">{t("invoice.deductible")}</Table.Column>
                      <Table.Column className="text-end">{t("order.patientVat")}</Table.Column>
                      <Table.Column className="text-end">{t("order.payerVat")}</Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {rows.map((r) => (
                        <Table.Row key={r.code}>
                          <Table.Cell><b>{r.name}</b><div className="text-[11px] text-muted">{r.code}</div></Table.Cell>
                          <Table.Cell className="text-end tabular-nums">{fmt(r.calc.gross)}</Table.Cell>
                          <Table.Cell className="text-end tabular-nums">{r.calc.discount ? fmt(r.calc.discount) : "—"}</Table.Cell>
                          <Table.Cell className="text-end tabular-nums">{r.calc.deductible ? fmt(r.calc.deductible) : "—"}</Table.Cell>
                          <Table.Cell className="text-end font-semibold tabular-nums">{fmt(r.calc.patientWithTax)}</Table.Cell>
                          <Table.Cell className="text-end tabular-nums">{fmt(r.calc.companyWithTax)}</Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
                <Table.Footer className="flex flex-wrap gap-4 border-t border-border px-3 py-2 text-xs">
                  <span>{t("invoice.totals", { vat: Math.round(VAT * 100) })}</span>
                  <span className="ms-auto tabular-nums">{fmt(tot.g)} · {fmt(tot.d)} · {fmt(tot.ded)} · <b>{fmt(tot.pt)}</b> · {fmt(tot.co)}</span>
                </Table.Footer>
              </Table>
            )}
            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-default/50 p-3 text-sm">
              <span className={inv.paid || isWallet ? "font-semibold text-success" : "font-semibold text-warning"}>
                {isWallet ? doc.wtype : inv.paid ? t("invoice.paidInFull", { via: inv.via }) : t("invoice.outstanding")}
              </span>
              {!isWallet && inv.payments && inv.payments.length > 1 && (
                <span className="text-xs text-muted">{inv.payments.map((x) => `${modeLabel(x.mode)} ${fmt(x.amount)}`).join(" + ")}</span>
              )}
              <span className="ms-auto">{t("invoice.patientPaid")} <b className="tabular-nums" data-testid="inv-total">{fmt(isWallet ? doc.amount : inv.patient)}</b></span>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onPress={close}>{t("event.close")}</Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
