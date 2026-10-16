import { Button, Card, Chip, Disclosure, Label, Link, Switch, Table } from "@heroui/react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { pairInvoices, patientInvoiceSummary } from "../../domain/invoices";
import { fmt } from "../../domain/money";
import { packageItems } from "../../domain/replace";
import { useW } from "../../store/hooks";
import { openInvoicesFor, openPkgBook, useUi } from "../../store/ui";
import { InvoiceTable } from "../invoices/InvoiceTable";
import { InvoiceLink } from "../../ui/InvoiceLink";

/* v3 renderPatientInvoices() (line 4825): every invoice this patient has, across all their visits — folded away
   until asked for, with the headline figures in the header */
export function PatientInvoicesCard({ mrn }: { mrn: string }) {
  const { t } = useTranslation();
  const w = useW();
  const { pinvOpen, invGroup, set } = useUi();
  const s = patientInvoiceSummary(w, mrn);
  return (
    <Card className="gap-0 border-s-4 border-s-vida-navy p-0" data-testid="patient-invoices">
      <Disclosure isExpanded={pinvOpen} onExpandedChange={(v) => set({ pinvOpen: v })}>
        <Disclosure.Heading>
          <Disclosure.Trigger className="flex w-full items-center justify-start gap-2 px-4 py-3 text-start">
            <h2 className="text-xs font-bold uppercase tracking-wider text-vida-navy">{t("patient.invoices")}</h2>
            <span className="ms-auto text-xs text-muted">
              {t("patient.invoicesHead", {
                count: s.count,
                docs: s.walletDocs ? t("patient.invoicesDocs", { count: s.walletDocs }) : "",
                paid: fmt(s.paid),
                credit: s.onCredit > 0 ? t("patient.invoicesCredit", { amount: fmt(s.onCredit) }) : "",
              })}
            </span>
            <Disclosure.Indicator className="ms-2"><ChevronDown className="size-4" /></Disclosure.Indicator>
          </Disclosure.Trigger>
        </Disclosure.Heading>
        <Disclosure.Content>
          <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 pb-3">
            <Switch className="flex-row items-center gap-2" isSelected={invGroup} onChange={(v) => set({ invGroup: v })} aria-describedby="inv-pair-hint">
              <Switch.Control><Switch.Thumb /></Switch.Control>
              <Switch.Content><Label>{t("patient.pairInvoices")}</Label></Switch.Content>
            </Switch>
            <span id="inv-pair-hint" className="sr-only">{t("patient.pairInvoicesTitle")}</span>
            <Link className="ms-auto cursor-pointer text-sm" onPress={() => openInvoicesFor(mrn)}>{t("patient.allInvoices")}</Link>
          </div>
          {/* nothing is loaded until it is expanded (v3) */}
          {pinvOpen && <InvoiceTable list={invGroup ? pairInvoices(w, s.list) : s.list} emptyNote={t("patient.noInvoices")} label={t("patient.invoices")} />}
        </Disclosure.Content>
      </Disclosure>
    </Card>
  );
}

/* v3 renderPackageItems() (line 4789): procedures paid inside a package — only shown when there are any */
export function PackageItemsCard({ mrn }: { mrn: string }) {
  const { t } = useTranslation();
  const w = useW();
  const { pkgOpen, set, openVisit } = useUi();
  const items = packageItems(w, mrn);
  if (!items.length) return null;
  const left = items.filter((x) => !x.child.visitId);
  return (
    <Card className="gap-0 p-0">
      <Disclosure isExpanded={pkgOpen} onExpandedChange={(v) => set({ pkgOpen: v })}>
        <div className="flex items-center gap-2 pe-3">
          <Disclosure.Heading className="min-w-0 flex-1">
            <Disclosure.Trigger className="flex w-full items-center justify-start gap-2 px-4 py-3 text-start">
              <h2 className="text-xs font-bold uppercase tracking-wider text-vida-navy">{t("patient.packageProcedures")}</h2>
              <span className="ms-auto text-xs text-muted">{t("patient.packageCount", { left: left.length, count: items.length })}</span>
              <Disclosure.Indicator className="ms-2"><ChevronDown className="size-4" /></Disclosure.Indicator>
            </Disclosure.Trigger>
          </Disclosure.Heading>
          {left.length > 0 && <Button size="sm" variant="ghost" onPress={() => openPkgBook(mrn)}>{t("patient.bookAll")}</Button>}
        </div>
        <Disclosure.Content>
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label={t("patient.packageProcedures")}>
                <Table.Header>
                  <Table.Column isRowHeader>{t("patient.pkgCols.procedure")}</Table.Column>
                  <Table.Column>{t("patient.pkgCols.package")}</Table.Column>
                  <Table.Column>{t("patient.pkgCols.billedOn")}</Table.Column>
                  <Table.Column>{t("patient.pkgCols.visit")}</Table.Column>
                  <Table.Column><span className="sr-only">{t("patient.pkgCols.action")}</span></Table.Column>
                </Table.Header>
                <Table.Body>
                  {items.map((x) => {
                    const v = x.doneOn;
                    return (
                      <Table.Row key={`${x.inv.id}-${x.child.code}`}>
                        <Table.Cell><b>{x.child.name}</b><div className="text-xs text-muted">{x.child.code}</div></Table.Cell>
                        <Table.Cell>{x.parent.name}<div className="text-xs text-muted">{t("patient.paidInFull")}</div></Table.Cell>
                        <Table.Cell><InvoiceLink id={x.inv.id} /><div className="text-xs text-muted">{x.inv.at}</div></Table.Cell>
                        <Table.Cell>
                          {v ? <Chip size="sm" color="success" variant="soft">{v.visitType} · {v.date} {v.arrived}</Chip>
                            : <Chip size="sm" color="warning" variant="soft">{t("patient.notBooked")}</Chip>}
                        </Table.Cell>
                        <Table.Cell>
                          {v ? <Button size="sm" variant="outline" onPress={() => openVisit(v.id, mrn)}>{t("patient.openVisit")}</Button>
                            : <Button size="sm" variant="primary" onPress={() => openPkgBook(mrn, x.child.code)}>{t("patient.bookOne")}</Button>}
                        </Table.Cell>
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        </Disclosure.Content>
      </Disclosure>
    </Card>
  );
}
