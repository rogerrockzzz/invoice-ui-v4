import { Button, Chip, Table } from "@heroui/react";
import { ArrowLeftRight, CornerDownRight } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { WALLET_DOC } from "../../domain/constants";
import type { DocRow, PairedRow } from "../../domain/invoices";
import { refundable, refundedOf, refundState } from "../../domain/lines";
import { pt } from "../../domain/lookup";
import { fmt } from "../../domain/money";
import type { Invoice, Msg, WalletDoc } from "../../domain/types";
import { useW } from "../../store/hooks";
import { useUi } from "../../store/ui";
import { ComingSoon } from "../../ui/ComingSoon";
import { InvoiceLink } from "../../ui/InvoiceLink";
import { M } from "../../ui/Rich";
import { useReprint } from "./InvoiceModal";

type Row = DocRow & { sep?: undefined; child?: Msg | null };
type Entry = PairedRow | Row;

/* v3 invoiceTable() (line 4733): the shared invoice table — visit invoices, refund invoices and wallet documents */
export function InvoiceTable({ list, showPatient, emptyNote, label }: { list: Entry[]; showPatient?: boolean; emptyNote: string; label: string }) {
  const { t } = useTranslation();
  const w = useW();
  const set = useUi((s) => s.set);
  const reprint = useReprint();
  const sub = (x: ReactNode) => <div className="text-[11px] text-muted">{x}</div>;
  const acts = (id: string, refund?: boolean) => (
    <div className="flex justify-end gap-1">
      <Button size="sm" variant="outline" aria-label={`${t("event.view")} ${id}`} onPress={() => set({ invPop: id })}>{t("event.view")}</Button>
      <Button size="sm" variant="outline" aria-label={`${t("invoices.reprint")} ${id}`} onPress={() => reprint(id)}>{t("invoices.reprint")}</Button>
      {refund && (
        <ComingSoon when="M2" label={t("event.refund")} className="inline-flex h-8 items-center rounded-full border border-danger/50 px-3 text-xs text-danger">
          {t("invoices.refund")}
        </ComingSoon>
      )}
    </div>
  );
  const idCell = (e: Row, id: string, at: string) => (
    <Table.Cell>
      {e.child && <span className="flex items-center gap-1 text-[11px] text-muted"><CornerDownRight className="size-3 rtl:-scale-x-100" /><M msg={e.child} /></span>}
      <span className="whitespace-nowrap"><InvoiceLink id={id} /></span>{sub(at)}
    </Table.Cell>
  );
  const patientCell = (e: DocRow) => showPatient ? <Table.Cell><b>{pt(w, e.c).name}</b>{sub(`MRN ${pt(w, e.c).mrn}`)}</Table.Cell> : null;
  const cols = showPatient ? 9 : 8;

  return (
    <Table data-testid="invoice-table">
      <Table.ScrollContainer>
        <Table.Content aria-label={label}>
          <Table.Header>
            <Table.Column isRowHeader>{t("invoices.col.invoice")}</Table.Column>
            {showPatient ? <Table.Column>{t("invoices.col.patient")}</Table.Column> : null}
            <Table.Column>{t("invoices.col.visit")}</Table.Column>
            <Table.Column>{t("invoices.col.for")}</Table.Column>
            <Table.Column className="text-end">{t("invoices.col.patientAmt")}</Table.Column>
            <Table.Column className="text-end">{t("invoices.col.payer")}</Table.Column>
            <Table.Column>{t("invoices.col.mode")}</Table.Column>
            <Table.Column>{t("invoices.col.status")}</Table.Column>
            <Table.Column><span className="sr-only">{t("invoices.col.actions")}</span></Table.Column>
          </Table.Header>
          <Table.Body renderEmptyState={() => <span className="text-sm text-muted">{emptyNote}</span>}>
            {list.map((e, i) => {
              if (e.sep) return (
                <Table.Row key={`sep-${i}`} className="bg-default/50" data-row="group">
                  <Table.Cell>
                    <b className="text-vida-navy">{e.sep.title || t("invoices.walletGroup")}</b>
                    {e.sep.count > 0 && <Chip size="sm" variant="soft" className="ms-2">{t("invoices.related", { count: e.sep.count })}</Chip>}
                    <div className="text-[11px] text-muted"><M msg={e.sep.sub} /></div>
                  </Table.Cell>
                  {Array.from({ length: cols - 1 }, (_, j) => <Table.Cell key={j}>{""}</Table.Cell>)}
                </Table.Row>
              );
              const { c } = e;
              if (e.inv.kind === "wallet") {
                const d = e.inv as WalletDoc, ty = WALLET_DOC[d.wtype]!, v = w.cases.find((x) => x.id === d.visitId);
                return (
                  <Table.Row key={`${d.id}-${i}`} data-row="wallet" data-inv={d.id}>
                    {idCell(e, d.id, `${d.date && d.date !== "Today" ? d.date + " " : ""}${d.at}`)}
                    {patientCell(e)}
                    <Table.Cell>{v ? v.clinic : t("invoices.patientWallet")}{sub(v ? `${v.visitType} · ${v.date || ""} ${v.arrived}` : t("invoices.notTied"))}</Table.Cell>
                    <Table.Cell>{t(`walletDoc.label.${d.wtype}`)}{sub(d.invoiceId ? <InvoiceLink id={d.invoiceId} /> : d.cat ? t("wallet.pot", { pot: d.cat }) : "")}</Table.Cell>
                    <Table.Cell className="whitespace-nowrap text-end font-semibold tabular-nums">{ty.sign < 0 ? "−" : "+"}{fmt(d.amount)}</Table.Cell>
                    <Table.Cell className="text-end">—</Table.Cell>
                    <Table.Cell>{d.mode || "—"}</Table.Cell>
                    <Table.Cell><Chip size="sm" variant="soft" className="whitespace-nowrap" color={ty.acct === "Credit" ? "warning" : "accent"}>{t(`walletDoc.acct.${ty.acct}`)}</Chip></Table.Cell>
                    <Table.Cell>{acts(d.id)}</Table.Cell>
                  </Table.Row>
                );
              }
              const inv = e.inv as Invoice & { refOf?: string };
              if (inv.kind === "refund") return (
                <Table.Row key={`${inv.id}-${i}`} data-row="refund" data-inv={inv.id}>
                  {idCell(e, inv.id, inv.at)}
                  {patientCell(e)}
                  <Table.Cell>{c.clinic}{sub(`${c.visitType} · ${c.date || ""} ${c.arrived}`)}</Table.Cell>
                  <Table.Cell>{t("invoices.refundInvoice")}{sub(<>{t("invoices.of")} <InvoiceLink id={inv.refOf || ""} /></>)}</Table.Cell>
                  <Table.Cell className="whitespace-nowrap text-end font-semibold tabular-nums">−{fmt(inv.patient)}</Table.Cell>
                  <Table.Cell className="whitespace-nowrap text-end tabular-nums">{inv.company ? `−${fmt(inv.company)}` : "—"}</Table.Cell>
                  <Table.Cell>{inv.via || "—"}</Table.Cell>
                  <Table.Cell><Chip size="sm" variant="soft" className="whitespace-nowrap" color="danger">{t("invoices.status.Refund")}</Chip></Table.Cell>
                  <Table.Cell>{acts(inv.id)}</Table.Cell>
                </Table.Row>
              );
              const rs = refundState(inv);
              return (
                <Table.Row key={`${inv.id}-${i}`} data-row="invoice" data-inv={inv.id}>
                  {idCell(e, inv.id, inv.at)}
                  {patientCell(e)}
                  <Table.Cell>{c.clinic}{sub(<>{c.visitType} · {c.date || ""} {c.arrived}{inv.branch && <> · <ArrowLeftRight className="inline size-3" /> {inv.branch}</>}</>)}</Table.Cell>
                  <Table.Cell>{t(inv.scope === "consult" ? "event.scopeConsult" : "event.scopeOrders")}{sub(t("invoices.lines", { count: inv.rows.length }))}</Table.Cell>
                  <Table.Cell className="whitespace-nowrap text-end font-semibold tabular-nums">{fmt(inv.patient)}</Table.Cell>
                  <Table.Cell className="whitespace-nowrap text-end tabular-nums">{fmt(inv.company)}</Table.Cell>
                  <Table.Cell>{inv.via || "—"}</Table.Cell>
                  <Table.Cell>
                    <Chip size="sm" variant="soft" className="whitespace-nowrap" color={rs ? "warning" : inv.paid ? "success" : "warning"}>
                      {rs ? t(`invoices.status.${rs}`) : t(inv.paid ? "invoices.status.Paid" : "invoices.status.On credit")}
                    </Chip>
                    {refundedOf(inv) > 0 && sub(t("invoices.refunded", { amount: fmt(refundedOf(inv)) }))}
                  </Table.Cell>
                  <Table.Cell>{acts(inv.id, refundable(w, inv))}</Table.Cell>
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}
