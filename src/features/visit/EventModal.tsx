import { Button, Chip, Modal, Table } from "@heroui/react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { USER } from "../../domain/constants";
import { refundable } from "../../domain/lines";
import { findInvoice, payerName, pt } from "../../domain/lookup";
import { fmt } from "../../domain/money";
import type { Invoice } from "../../domain/types";
import { useW } from "../../store/hooks";
import { openInvoicesFor, openRefund, useUi } from "../../store/ui";
import { InvoiceLink } from "../../ui/InvoiceLink";

const INS_COLOR: Record<string, "success" | "accent" | "warning" | "default"> = { approved: "success", partial: "accent", pending: "warning" };

/* v3 renderEventPop() (line 4472): what happened, in detail */
export function EventModal() {
  const { t, i18n } = useTranslation();
  const w = useW();
  const { eventPop, set } = useUi();
  const c = eventPop ? w.cases.find((x) => x.id === eventPop.caseId) : null;
  const h = c && eventPop ? c.history[eventPop.i] : null;
  const close = () => set({ eventPop: null });
  if (!c || !h) return null;
  const p = pt(w, c);
  const rows: [string, ReactNode][] = [];
  const add = (k: string, v: ReactNode) => { if (v !== undefined && v !== null && v !== "") rows.push([k, v]); };
  add(t("event.when"), t("event.today", { at: h.at }));
  add(t("event.by"), h.by || USER);
  add(t("event.patient"), `${p.name} · MRN ${p.mrn}`);
  add(t("event.visit"), `${c.visitType} · ${c.clinic} · Dr ${c.doctor}`);
  if (h.amount !== undefined) add(t(h.type === "ADVANCE" ? "event.amountReceived" : h.type === "CREDIT" ? "event.amountSettled" : "event.patientShare"), fmt(h.amount));
  if (h.company) add(t("event.payerShare", { payer: payerName(w, c) }), fmt(h.company));
  if (h.deductible) add(t("event.deductible"), fmt(h.deductible));
  add(t("event.mode"), h.mode);
  add(t("event.ref"), h.ref as string);
  add(t("event.advType"), h.cat ? t("event.advCat", { cat: h.cat }) : "");
  add(t("event.scope"), h.scope === "consult" ? t("event.scopeConsult") : h.scope === "orders" ? t("event.scopeOrders") : "");
  if (h.type === "PAYER") { add(t("event.was"), h.from as string); add(t("event.now"), h.to as string); }
  const ids = (h.invoiceIds as string[] | undefined) || [];
  if (ids.length > 1) add(t("event.invoicesSettled"), <>{ids.map((id, i) => <span key={id}>{i > 0 && " · "}<InvoiceLink id={id} /></span>)}</>);
  else add(t("event.invoice"), h.invoiceId ? <InvoiceLink id={h.invoiceId} /> : h.type === "PAYMENT" ? "—" : "");
  const settled = (h.settled as { id: string; amount: number; visit: string }[] | undefined) || [];
  const hit = h.invoiceId ? findInvoice(w, h.invoiceId) : null;
  const canRefund = !!hit && refundable(w, hit.inv as Invoice);
  const title = i18n.exists(`event.title.${h.type}`) ? t(`event.title.${h.type}`) : t("event.title.default");

  return (
    <Modal.Backdrop isOpen onOpenChange={(o) => { if (!o) close(); }}>
      <Modal.Container size="lg">
        <Modal.Dialog aria-label={title}>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>{title}</Modal.Heading>
            <p className="text-sm text-muted">{h.tx.replace(/<[^>]+>/g, "")}</p>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm" data-testid="event-rows">
              {rows.map(([k, v]) => <div key={k} className="contents"><dt className="text-muted">{k}</dt><dd className="font-semibold">{v}</dd></div>)}
            </dl>
            {settled.length > 0 && (
              <Table>
                <Table.ScrollContainer>
                  <Table.Content aria-label={t("event.invoicesSettled")}>
                    <Table.Header>
                      <Table.Column isRowHeader>{t("event.invoice")}</Table.Column>
                      <Table.Column>{t("event.raisedOn")}</Table.Column>
                      <Table.Column className="text-end">{t("event.amount")}</Table.Column>
                      <Table.Column><span className="sr-only">{t("event.view")}</span></Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {settled.map((x) => (
                        <Table.Row key={x.id}>
                          <Table.Cell><InvoiceLink id={x.id} /></Table.Cell>
                          <Table.Cell>{x.visit}</Table.Cell>
                          <Table.Cell className="text-end font-semibold tabular-nums">{fmt(x.amount)}</Table.Cell>
                          <Table.Cell><Button size="sm" variant="outline" onPress={() => set({ invPop: x.id, eventPop: null })}>{t("event.view")}</Button></Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
            )}
            {h.lines && h.lines.length > 0 && (
              <Table>
                <Table.ScrollContainer>
                  <Table.Content aria-label={t("event.lines")}>
                    <Table.Header>
                      <Table.Column isRowHeader>{t("order.procedure")}</Table.Column>
                      <Table.Column>{t("order.approval")}</Table.Column>
                      <Table.Column className="text-end">{t("order.price")}</Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {h.lines.map((l, i) => (
                        <Table.Row key={`${l.code}-${i}`}>
                          <Table.Cell><b>{l.name}</b><div className="text-[11px] text-muted">{l.code}</div></Table.Cell>
                          <Table.Cell>
                            <Chip size="sm" variant="soft" color={INS_COLOR[l.ins || ""] || "default"}>
                              {i18n.exists(`ins.${l.ins}`) ? t(`ins.${l.ins}`) : l.ins}
                            </Chip>
                          </Table.Cell>
                          <Table.Cell className="text-end tabular-nums">{l.price ? fmt(l.price) : "—"}</Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
            )}
          </Modal.Body>
          <Modal.Footer className="flex-wrap">
            {h.invoiceId && <Button variant="primary" onPress={() => set({ invPop: h.invoiceId!, eventPop: null })}>{t("event.preview", { id: h.invoiceId })}</Button>}
            {canRefund && (
              <Button variant="danger" onPress={() => openRefund(h.invoiceId!)}>{t("event.refund")}</Button>
            )}
            <Button variant="outline" onPress={() => openInvoicesFor(p.mrn)}>{t("event.goInvoices")}</Button>
            <Button variant="secondary" onPress={close}>{t("event.close")}</Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
