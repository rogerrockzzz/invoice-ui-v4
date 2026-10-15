import { Table } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { ADV_CATS, LEDGER_LABEL, USER } from "../../domain/constants";
import { ledgerRows } from "../../domain/ledger";
import { creditTotal } from "../../domain/lines";
import { fmt, round2 } from "../../domain/money";
import { useW } from "../../store/hooks";
import { InvoiceLink } from "../../ui/InvoiceLink";

/* v3 renderLedger() (line 4863): advance and credit are two accounts, each with its own statement and its own
   running balance, ending at the real figure */
export function LedgerTable({ mrn, kind }: { mrn: string; kind: "ADV" | "CREDIT" }) {
  const { t, i18n } = useTranslation();
  const w = useW();
  const rows = ledgerRows(w, mrn, kind);
  const cr = kind === "CREDIT";
  const wal = w.patients[mrn]!.wallet;
  const inTot = round2(rows.filter((r) => r.inflow).reduce((a, r) => a + r.amount, 0));
  const outTot = round2(rows.filter((r) => !r.inflow).reduce((a, r) => a + r.amount, 0));
  const left = cr ? creditTotal(w, mrn) : ADV_CATS.reduce((a, k) => a + wal.advance[k], 0);
  const label = (type: string) => (i18n.exists(`ledgerLabel.${type}`) ? t(`ledgerLabel.${type}`) : LEDGER_LABEL[type] || type);
  return (
    <div className="flex flex-col gap-3" data-testid={`ledger-${kind}`}>
      <div className="grid grid-cols-3 gap-2">
        <Figure k={t(cr ? "ledger.ui.putOnCredit" : "ledger.ui.received")} v={fmt(inTot)} />
        <Figure k={t(cr ? "ledger.ui.settled" : "ledger.ui.used")} v={fmt(outTot)} />
        <Figure k={t(cr ? "ledger.ui.outstanding" : "ledger.ui.available")} v={fmt(left)} tone={cr ? (left > 0 ? "text-warning" : "") : "text-success"} testId={`ledger-left-${kind}`} />
      </div>
      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label={t(cr ? "ledger.ui.creditStatement" : "ledger.ui.advanceStatement")}>
            <Table.Header>
              <Table.Column isRowHeader>{t("ledger.ui.when")}</Table.Column>
              <Table.Column>{t("ledger.ui.movement")}</Table.Column>
              <Table.Column>{t("ledger.ui.invoice")}</Table.Column>
              <Table.Column>{t("ledger.ui.by")}</Table.Column>
              <Table.Column className="text-end">{t("ledger.ui.amount")}</Table.Column>
              <Table.Column className="text-end">{t(cr ? "ledger.ui.creditLeft" : "ledger.ui.advanceLeft")}</Table.Column>
            </Table.Header>
            <Table.Body renderEmptyState={() => <span className="text-xs text-muted">{t(cr ? "ledger.ui.noCredit" : "ledger.ui.noAdvance")}</span>}>
              {rows.map((r) => (
                <Table.Row key={r.k || `${r.type}-${r.at}`} data-type={r.type}>
                  <Table.Cell>{r.date || t("tile.today")}<div className="text-[11px] text-muted">{r.at}</div></Table.Cell>
                  <Table.Cell>
                    <b>{label(r.type)}</b>{r.docId && <> <InvoiceLink id={r.docId} /></>}
                    <div className="text-[11px] text-muted">{r.note || ""}{r.mode ? ` · ${r.mode}` : ""}</div>
                  </Table.Cell>
                  <Table.Cell>{r.invoiceId ? <InvoiceLink id={r.invoiceId} /> : <span className="text-muted">—</span>}</Table.Cell>
                  <Table.Cell className="text-xs text-muted">{r.by || USER}</Table.Cell>
                  <Table.Cell className={`text-end font-semibold tabular-nums ${r.inflow ? (cr ? "text-warning" : "text-success") : cr ? "text-success" : "text-danger"}`}>
                    {r.inflow ? "+" : "−"}{fmt(r.amount).replace("SAR ", "")}
                  </Table.Cell>
                  <Table.Cell className="text-end tabular-nums">{fmt(r.balance)}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
    </div>
  );
}

function Figure({ k, v, tone, testId }: { k: string; v: string; tone?: string; testId?: string }) {
  return (
    <div className="rounded-xl bg-default/50 px-3 py-2">
      <div className="text-[11px] text-muted">{k}</div>
      <b className={`tabular-nums ${tone || ""}`} data-testid={testId}>{v}</b>
    </div>
  );
}
