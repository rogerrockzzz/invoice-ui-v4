import { Alert, Button, Card, Chip, Label, ListBox, Select, Table } from "@heroui/react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cashHeld, liveInvoices } from "../../domain/lines";
import { payerOf, planOf, pt } from "../../domain/lookup";
import { fmt, round2 } from "../../domain/money";
import { invoiceReplace, isApproved, replacePreview } from "../../domain/replace";
import type { Visit } from "../../domain/types";
import { checkApproval } from "../../store/actions";
import { useW } from "../../store/hooks";
import { checkInsurerApproval, doReplace, linesOf } from "../../store/replace";
import { openReplace, useUi, type ReplaceUi } from "../../store/ui";
import { useWorld } from "../../store/world";
import { InvoiceLink } from "../../ui/InvoiceLink";
import { T } from "../../ui/Rich";

const Tag = () => {
  const { t } = useTranslation();
  return <Chip size="sm" variant="soft" color="accent" className="self-start">{t("story.replace.title")}</Chip>;
};

/* v3 renderReplaceStory() (line 2871): choose what moves; the insurer and the settlement carry the rest */
export function ReplaceStory({ c, top }: { c: Visit; top: ReactNode }) {
  const { t } = useTranslation();
  const w = useW();
  const act = useWorld((s) => s.act);
  const insured = !!planOf(w, c);
  const rows = liveInvoices(c).map((inv) => ({ inv, r: invoiceReplace(w, c, inv) })).filter((x) => x.r);
  const outstanding = insured && cashHeld(c).length > 0;
  return (
    <Card className="gap-3 border-s-4 border-s-accent p-5" data-testid="step-card" data-step="REPLACE_LIST">
      {top}
      <Tag />
      <h2 className="text-lg font-bold text-vida-navy" data-testid="step-q">{t(insured ? "replace.listQIns" : "replace.listQCash")}</h2>
      <p className="text-sm text-muted">{insured ? t("replace.listSubIns", { payer: payerOf(w, c).label }) : t("replace.listSubCash")}</p>
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
        {rows.map(({ inv, r }) => (
          <li key={inv.id} className="flex items-center gap-3 px-3 py-2" data-testid="replace-row" data-inv={inv.id}>
            <span className="min-w-0 flex-1 leading-tight">
              <InvoiceLink id={inv.id} />
              <span className="block text-xs text-muted">{inv.at} · {inv.rows.map((x) => x.name).join(", ")} · {inv.via || ""}</span>
            </span>
            <b className="tabular-nums">{fmt(inv.patient)}</b>
            <span className="flex min-w-24 justify-end">
              {r!.ok ? <Button size="sm" variant="primary" onPress={() => openReplace(c, inv.id)}>{t("replace.replace")}</Button>
                : <Chip size="sm" variant="soft" color="warning">{t("replace.approvalOutstanding")}</Chip>}
            </span>
          </li>
        ))}
      </ul>
      {outstanding && (
        <div className="flex flex-wrap gap-2" data-testid="step-actions">
          <Button variant="outline" onPress={() => act(c.id, checkApproval)}>{t("replace.checkApproval")}</Button>
        </div>
      )}
    </Card>
  );
}

/* v3 renderReplaceWork() / renderReplacePop() (lines 5006–5096): the replacement worked in the story card */
export function ReplaceWork({ c, d, top }: { c: Visit; d: ReplaceUi; top: ReactNode }) {
  const { t } = useTranslation();
  const w = useW();
  const act = useWorld((s) => s.act);
  const actW = useWorld((s) => s.actW);
  const { upd, openDrawer } = useUi();
  const only = linesOf(c, d.codes);
  const pv = replacePreview(w, c, d.to, d.payerId, only);
  const insPayers = pt(w, c).payers.filter((p) => p.plan);
  const label = insPayers.find((p) => p.id === d.payerId)?.label || t("replace.theInsurer");
  const ids = pv.ids.join(", ");
  const go = () => {
    if (pv.missing.length) return;
    const out = actW((dw, fx) => {
      const dc = dw.cases.find((x) => x.id === c.id)!;
      return doReplace(dw, dc, d.to, d.payerId, linesOf(dc, d.codes), fx);
    });
    upd((s) => { s.replace = null; });
    if (out) openDrawer(c.id, c.mrn, out.refundDiff, { refundDiff: { reason: t("replace.diffReason", { to: d.to }), to: d.to } });
  };
  const ok = (st: string | null) => isApproved(st as never);
  return (
    <Card className="gap-3 border-s-4 border-s-accent p-5" data-testid="step-card" data-step="REPLACE_WORK">
      {top}
      <Tag />
      <h2 className="text-lg font-bold text-vida-navy" data-testid="step-q">{t("replace.workQ", { ids })}</h2>
      <p className="text-sm text-muted">{t("replace.workSub", { name: pt(w, c).name, type: c.visitType, clinic: c.clinic })}</p>
      <Alert status="accent">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Description>
            <b>{t("replace.reversed", { ids, what: t(pv.rows.length === 1 ? "replace.thisLine" : "replace.theseLines") })}</b>
            {!planOf(w, c) && pv.rows.some((r) => r.line === c.consult) && <> {t("replace.visitMoves")}</>}
          </Alert.Description>
        </Alert.Content>
      </Alert>
      {!planOf(w, c) && insPayers.length > 0 && (
        <Select className="max-w-md" value={d.payerId} onChange={(v) => { if (typeof v === "string") upd((s) => { if (s.replace) s.replace.payerId = v; }); }}>
          <Label>{t("replace.insurer")}</Label>
          <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
          <Select.Popover>
            <ListBox>
              {insPayers.map((p) => {
                const n = pv.rows.length ? replacePreview(w, c, "insurance", p.id, only).rows.filter((r) => isApproved(r.approval)).length : 0;
                const text = t("replace.insurerOpt", { label: p.label, n, count: pv.rows.length });
                return (
                  <ListBox.Item key={p.id} id={p.id} textValue={text}>
                    <Label>{text}</Label>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                );
              })}
            </ListBox>
          </Select.Popover>
        </Select>
      )}
      <div className={`flex flex-wrap items-center gap-3 rounded-xl p-3 text-sm ${pv.missing.length ? "bg-warning/10" : "bg-success/10"}`} data-testid="replace-approvals">
        {pv.missing.length ? (
          <>
            <span className="flex-1"><T k="replace.apprPart" p={{ n: pv.rows.length - pv.missing.length, count: pv.rows.length, label }} /></span>
            <Button size="sm" variant="outline" onPress={() => act(c.id, (dw, dc, fx) => checkInsurerApproval(dw, dc, d.payerId, replacePreview(dw, dc, d.to, d.payerId, linesOf(dc, d.codes)).rows.map((r) => r.line), fx))}>
              {t("replace.checkApproval")}
            </Button>
          </>
        ) : <span><T k="replace.apprAll" p={{ label, count: pv.rows.length }} /></span>}
      </div>
      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label={t("replace.col.line")}>
            <Table.Header>
              <Table.Column isRowHeader>{t("replace.col.line")}</Table.Column>
              <Table.Column>{t("replace.col.approval")}</Table.Column>
              <Table.Column className="text-end">{t("replace.col.now")}</Table.Column>
              <Table.Column className="text-end">{t("replace.col.tariff")}</Table.Column>
              <Table.Column className="text-end">{t("replace.col.patient")}</Table.Column>
              <Table.Column className="text-end">{t("replace.col.payer")}</Table.Column>
            </Table.Header>
            <Table.Body>
              {[
                ...pv.rows.map((r) => {
                  const yes = ok(r.approval);
                  return (
                    <Table.Row key={r.line.code} data-testid="replace-line">
                      <Table.Cell><b>{r.line.name}</b><div className="text-[11px] text-muted">{r.line.code} · {t(r.line === c.consult ? "replace.visitCharge" : "replace.order")}</div></Table.Cell>
                      <Table.Cell>
                        <Chip size="sm" variant="soft" color={yes ? (r.approval === "partial" ? "accent" : "success") : "warning"}>
                          {yes ? t(`ins.${r.approval}`) : r.approval === "rejected" ? t("replace.rejected") : r.approval === "pending" ? t("replace.awaiting") : t("replace.notRequested")}
                        </Chip>
                      </Table.Cell>
                      <Table.Cell className="text-end text-muted tabular-nums">{fmt(r.was)}</Table.Cell>
                      <Table.Cell className="text-end font-semibold tabular-nums">{fmt(r.price)}</Table.Cell>
                      <Table.Cell className="text-end font-semibold tabular-nums">{yes ? fmt(r.calc.patientWithTax) : "—"}</Table.Cell>
                      <Table.Cell className="text-end tabular-nums">{yes ? fmt(r.calc.companyWithTax) : "—"}</Table.Cell>
                    </Table.Row>
                  );
                }),
                <Table.Row key="__total" className="font-semibold">
                  <Table.Cell>{t("replace.newTotal")}</Table.Cell>
                  <Table.Cell>{""}</Table.Cell>
                  <Table.Cell>{""}</Table.Cell>
                  <Table.Cell>{""}</Table.Cell>
                  <Table.Cell className="text-end tabular-nums" data-testid="replace-new-total">{pv.missing.length ? "—" : fmt(pv.newTotal)}</Table.Cell>
                  <Table.Cell className="text-end tabular-nums">{pv.missing.length ? "—" : fmt(round2(pv.rows.reduce((a, r) => a + r.calc.companyWithTax, 0)))}</Table.Cell>
                </Table.Row>,
              ]}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
      <dl className="flex flex-col gap-1 rounded-xl border border-border p-3 text-sm" data-testid="replace-sum">
        <div className="flex gap-4"><dt>{pv.ids.length ? t("replace.alreadyPaidOn", { ids }) : t("replace.alreadyPaid")}</dt><dd className="ms-auto font-semibold tabular-nums">{fmt(pv.oldPaid)}</dd></div>
        {pv.missing.length ? (
          <div className="flex gap-4 border-t border-border pt-1"><dt>{t("replace.shareLater")}</dt><dd className="ms-auto font-semibold">{t("replace.shownLater")}</dd></div>
        ) : (
          <>
            <div className="flex gap-4"><dt>{t("replace.newShare")}</dt><dd className="ms-auto font-semibold tabular-nums">{fmt(pv.newTotal)}</dd></div>
            <div className="flex items-baseline gap-4 border-t border-border pt-1">
              <dt className="font-semibold">{t(pv.diff > 0.004 ? "replace.toCollect" : pv.diff < -0.004 ? "replace.toGive" : "replace.nothing")}</dt>
              <dd className={`ms-auto text-xl font-bold tabular-nums ${pv.diff < -0.004 ? "text-danger" : ""}`} data-testid="replace-diff">{fmt(Math.abs(pv.diff))}</dd>
            </div>
          </>
        )}
      </dl>
      <div className="flex flex-wrap gap-2" data-testid="step-actions">
        <Button variant={pv.diff < -0.004 ? "danger" : "primary"} className={pv.diff < -0.004 ? "" : "bg-success text-success-foreground"} isDisabled={pv.missing.length > 0} onPress={go}>
          {pv.missing.length ? t("replace.waiting", { count: pv.missing.length })
            : pv.diff > 0.004 ? t("replace.goCollect", { amount: fmt(pv.diff) })
            : pv.diff < -0.004 ? t("replace.goRefund", { amount: fmt(-pv.diff) }) : t("replace.goNothing")}
        </Button>
        <Button variant="ghost" onPress={() => upd((s) => { s.replace = null; })}>{t("replace.another")}</Button>
      </div>
    </Card>
  );
}
