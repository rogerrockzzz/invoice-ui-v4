import { Breadcrumbs, Button, Card, DateField, Label, SearchField, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { parseDate, type DateValue } from "@internationalized/date";
import { useTranslation } from "react-i18next";
import { findInvoice } from "../../domain/lookup";
import { defaultInvFilters, invCanLoad, invFilterSummary, INV_FILTERS, INV_PRESETS, presetRange, type DocRow, type InvFilters, type InvPreset } from "../../domain/invoices";
import { fmt, round2 } from "../../domain/money";
import { useW } from "../../store/hooks";
import { loadInvoices, useUi } from "../../store/ui";
import { M } from "../../ui/Rich";
import { PickSelect } from "../../ui/PickSelect";
import { InvoiceTable } from "./InvoiceTable";

/* v3 renderInvoices() (line 4626): invoices are retrieved on request, never all at once. The search is the base
   filter; the receptionist then says what to retrieve, and only that is loaded. */
export function InvoicesScreen() {
  const { t } = useTranslation();
  const w = useW();
  const { invF: f, invQ, invLoaded: L, invEdit, caseId, activeMrn, set, upd } = useUi();
  const editing = !L || invEdit;
  const setF = (patch: Partial<InvFilters>) => upd((s) => { Object.assign(s.invF, patch); });
  const back = () => set({ screen: caseId ? "visit" : activeMrn ? "patient" : "home" });
  const toDate = (v: string): DateValue | null => (v ? parseDate(v) : null);
  /* the snapshot loaded, read from the live world (wallet documents are not visit invoices, as in v3) */
  const rows: DocRow[] = L ? L.ids.map((id) => findInvoice(w, id)).filter((x): x is DocRow => !!x) : [];
  const total = round2(rows.reduce((a, x) => a + (x.inv.kind === "refund" ? -(x.inv.patient || 0) : x.inv.patient || 0), 0));

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs>
        <Breadcrumbs.Item onPress={back}>{t("invoices.back")}</Breadcrumbs.Item>
        <Breadcrumbs.Item>{t("tabs.invoices")}</Breadcrumbs.Item>
      </Breadcrumbs>
      <Card>
        <Card.Content>
          <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); loadInvoices(); }}>
            <SearchField aria-label={t("invoices.find")} value={invQ} onChange={(v) => set({ invQ: v })} fullWidth className="flex-1">
              <Label>{t("invoices.find")}</Label>
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input placeholder={t("invoices.placeholder")} />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
            <Button type="submit" variant="outline">{t("invoices.search")}</Button>
          </form>
        </Card.Content>
      </Card>

      {editing && (
        <Card className="gap-3 p-5" data-testid="invoice-filters">
          <h2 className="text-base font-bold text-vida-navy">{t("invoices.whatQ")}</h2>
          <p className="text-sm text-muted">{t("invoices.whatSub")}</p>
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">{t("invoices.date")}</span>
          <div className="flex flex-wrap items-end gap-3">
            <ToggleButtonGroup aria-label={t("invoices.date")} selectionMode="single" selectedKeys={f.preset === "custom" ? [] : [f.preset]}
              onSelectionChange={(k) => { const id = [...k][0] as InvPreset | undefined; if (id) { const r = presetRange(id); setF({ preset: id, from: r[0], to: r[1] }); } }}
              className="flex flex-wrap justify-start gap-2">
              {(Object.keys(INV_PRESETS) as (keyof typeof INV_PRESETS)[]).map((k) => (
                <ToggleButton key={k} id={k} className="min-h-10 rounded-xl px-3">{t(`invoices.preset.${k}`)}</ToggleButton>
              ))}
            </ToggleButtonGroup>
            <DateField value={toDate(f.from)} onChange={(d) => setF({ from: d ? d.toString() : "", preset: "custom" })} className="w-40" granularity="day">
              <Label>{t("patient.from")}</Label>
              <DateField.Group><DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input></DateField.Group>
            </DateField>
            <DateField value={toDate(f.to)} onChange={(d) => setF({ to: d ? d.toString() : "", preset: "custom" })} className="w-40" granularity="day">
              <Label>{t("patient.to")}</Label>
              <DateField.Group><DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input></DateField.Group>
            </DateField>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {INV_FILTERS.map(([k, , list]) => (
              <PickSelect key={k} label={t(`invoices.filter.${k}`)} value={String(f[k] || "")} options={list(w)} any={t("invoices.any")}
                onChange={(v) => setF({ [k]: v } as Partial<InvFilters>)} testId={`filter-${k}`} />
            ))}
          </div>
          {f.preset === "any" && !invQ.trim() && <p className="text-sm text-warning">{t("invoices.anyNeedsSearch")}</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" isDisabled={!invCanLoad(f, invQ)} onPress={() => loadInvoices()}>{t("invoices.load")}</Button>
            <Button variant="ghost" onPress={() => set({ invF: defaultInvFilters() })}>{t("invoices.clear")}</Button>
            {L && <Button variant="ghost" onPress={() => set({ invEdit: false })}>{t("invoices.keep")}</Button>}
          </div>
        </Card>
      )}

      {L && (
        <>
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="text-lg font-bold text-vida-navy">{t("tabs.invoices")}</h1>
            <span className="text-sm text-muted" data-testid="invoices-summary">
              {t("invoices.loadedHead", { count: rows.length, total: fmt(total) })}{" "}
              <b>{invFilterSummary(L).map((b, i) => <span key={i}>{i > 0 && " · "}{typeof b === "string" ? b : <M msg={b} />}</span>)}</b>
              {" "}{t("invoices.loadedAt", { at: L.at })}
            </span>
            {!editing && <Button size="sm" variant="ghost" className="text-accent" onPress={() => set({ invEdit: true })}>{t("invoices.change")}</Button>}
          </div>
          <InvoiceTable list={rows} showPatient emptyNote={t("invoices.noMatch")} label={t("tabs.invoices")} />
        </>
      )}
    </div>
  );
}
