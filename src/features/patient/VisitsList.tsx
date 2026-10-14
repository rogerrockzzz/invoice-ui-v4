import { Button, Card, Chip, DateField, Disclosure, Input, Label, Switch, TextField } from "@heroui/react";
import { parseDate, type DateValue } from "@internationalized/date";
import { ArrowLeftRight, ChevronDown, CornerDownRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { payerOf, visitsOf } from "../../domain/lookup";
import { collected } from "../../domain/lines";
import { fmt } from "../../domain/money";
import { pendingSummary } from "../../domain/steps";
import type { Visit } from "../../domain/types";
import { isFuture, parentVisit, relationTo, rootVisit, visitDate, visitNo } from "../../domain/visits";
import { useW } from "../../store/hooks";
import { useUi } from "../../store/ui";
import { M } from "../../ui/Rich";

type Row = { c: Visit; child: Visit | null; size?: number };

/* v3 renderPatient() visits block (lines 3649–3726) */
export function VisitsList({ mrn }: { mrn: string }) {
  const { t } = useTranslation();
  const w = useW();
  const { profVisitsOpen: open, vf, visGroup, set, openVisit } = useUi();
  const vs = visitsOf(w, mrn);
  const shown = vs.filter((c) => {
    const want = vf.no.trim().toLowerCase().replace(/^v/, "");
    if (want && !visitNo(c).toLowerCase().replace(/^v/, "").includes(want)) return false;
    const d = visitDate(c);
    if (vf.from && d < vf.from) return false;
    if (vf.to && d > vf.to) return false;
    return true;
  });
  const filtered = !!(vf.no || vf.from || vf.to);

  /* paired: each group led by its first visit, children beneath in date order; groups by latest activity */
  let ordered: Row[] = shown.map((c) => ({ c, child: null }));
  if (visGroup) {
    const groups = new Map<number, Visit[]>();
    shown.forEach((c) => {
      const r = rootVisit(w, c), key = shown.includes(r) ? r.id : c.id;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(c);
    });
    ordered = [...groups.entries()]
      .sort((a, b) => Math.max(...b[1].map((x) => x.sortKey || 0)) - Math.max(...a[1].map((x) => x.sortKey || 0)))
      .flatMap(([key, list]) => {
        const head = list.find((x) => x.id === key)!;
        const kids = list.filter((x) => x !== head).sort((a, b) => (a.sortKey || 0) - (b.sortKey || 0));
        return [{ c: head, child: null, size: list.length }, ...kids.map((k) => ({ c: k, child: parentVisit(w, k) || head }))];
      });
  }
  const toDate = (v: string): DateValue | null => (v ? parseDate(v) : null);
  const setVf = (patch: Partial<typeof vf>) => set({ vf: { ...vf, ...patch } });

  return (
    <Card className="gap-0 p-0">
      <Disclosure isExpanded={open} onExpandedChange={(v) => set({ profVisitsOpen: v })}>
        <Disclosure.Heading>
          <Disclosure.Trigger className="flex w-full items-center justify-start gap-2 px-4 py-3 text-start">
            <h2 className="text-xs font-bold uppercase tracking-wider text-vida-navy">{t("patient.visits")}</h2>
            <span className="ms-auto text-xs text-muted">
              {filtered ? t("patient.visitsFiltered", { shown: shown.length, count: vs.length }) : t("patient.visitsCount", { count: vs.length })}
            </span>
            <Disclosure.Indicator className="ms-2"><ChevronDown className="size-4" /></Disclosure.Indicator>
          </Disclosure.Trigger>
        </Disclosure.Heading>
        <Disclosure.Content>
          <div className="flex flex-wrap items-end gap-3 border-b border-border px-4 pb-3">
            <TextField aria-label={t("patient.visitNo")} value={vf.no} onChange={(v) => setVf({ no: v })} className="w-52">
              <Input placeholder={t("patient.visitNoPlaceholder")} />
            </TextField>
            <DateField value={toDate(vf.from)} onChange={(d) => setVf({ from: d ? d.toString() : "" })} className="w-40" granularity="day">
              <Label>{t("patient.from")}</Label>
              <DateField.Group>
                <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
              </DateField.Group>
            </DateField>
            <DateField value={toDate(vf.to)} onChange={(d) => setVf({ to: d ? d.toString() : "" })} className="w-40" granularity="day">
              <Label>{t("patient.to")}</Label>
              <DateField.Group>
                <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
              </DateField.Group>
            </DateField>
            {filtered && <Button size="sm" variant="secondary" onPress={() => set({ vf: { no: "", from: "", to: "" } })}>{t("patient.clear")}</Button>}
            <Switch className="ms-auto flex-row items-center gap-2" isSelected={visGroup} onChange={(v) => set({ visGroup: v })} aria-describedby="pair-hint">
              <Switch.Control><Switch.Thumb /></Switch.Control>
              <Switch.Content><Label>{t("patient.pair")}</Label></Switch.Content>
            </Switch>
            <span id="pair-hint" className="sr-only">{t("patient.pairTitle")}</span>
          </div>

          <ul className="divide-y divide-border" aria-label={t("patient.visits")}>
            {ordered.map(({ c, child, size }) => <VisitRow key={c.id} c={c} child={child} size={size} groupHead={visGroup && !child && (size || 0) > 1} onOpen={() => openVisit(c.id, c.mrn)} />)}
          </ul>
          {!vs.length && <p className="p-4 text-sm text-muted">{t("patient.noVisits")}</p>}
          {vs.length > 0 && !shown.length && <p className="p-4 text-sm text-muted">{t("patient.noVisitMatch")}</p>}
        </Disclosure.Content>
      </Disclosure>
    </Card>
  );
}

const BADGE = {
  closed: "success", lwbs: "warning", upcoming: "default", act: "danger", ongoing: "accent", wait: "warning", done: "success",
} as const;

function VisitRow({ c, child, size, groupHead, onOpen }: { c: Visit; child: Visit | null; size?: number; groupHead: boolean; onOpen: () => void }) {
  const { t } = useTranslation();
  const w = useW();
  const { s, kind, owed } = pendingSummary(w, c);
  const badge = c.closed ? "closed" : c.lwbs ? "lwbs" : isFuture(c) ? "upcoming" : kind;
  const edge = c.closed ? "border-s-success/40" : kind === "act" ? "border-s-warning" : kind === "wait" ? "border-s-warning/60" : "border-s-accent/40";
  return (
    <li>
      <Button
        variant="ghost"
        onPress={onOpen}
        className={`h-auto w-full flex-col items-stretch justify-start gap-2 whitespace-normal rounded-none border-s-4 px-4 py-3 text-start font-normal md:flex-row md:items-center md:gap-4 ${edge} ${child ? "ps-10" : ""}`}
        data-testid={`visit-row-${c.id}`}
      >
        <div className="min-w-0 flex-1">
          {child && (
            <span className="flex items-center gap-1 text-xs text-muted">
              <CornerDownRight className="size-3 rtl:-scale-x-100" /> {t(`patient.rel.${relationTo(c)}`)} {visitNo(child)}
            </span>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <b className="text-vida-navy">{c.visitType} · {c.clinic}</b>
            {c.interbranch && (
              <Chip size="sm" variant="soft" className="bg-vida-purple-soft text-vida-purple"><ArrowLeftRight className="size-3" /> {c.fromBranch}</Chip>
            )}
            {groupHead && <Chip size="sm" variant="soft">{t("patient.related", { count: (size || 1) - 1 })}</Chip>}
          </div>
          <span className="text-xs text-muted">
            <b className="text-foreground">{visitNo(c)}</b> · {t("patient.visitMeta", { date: c.date, at: c.arrived, doctor: c.doctor, payer: payerOf(w, c).label, count: c.invoices.length })}
          </span>
        </div>
        <div className="text-start md:w-80 md:max-w-[45%]">
          <Chip size="sm" color={BADGE[badge]} variant="soft">{t(`patient.badge.${badge}`)}</Chip>
          <div className="mt-1 text-xs text-muted">
            {c.closed ? t("patient.collected", { amount: fmt(collected(c)) }) : <M msg={s.q} />}
          </div>
        </div>
        {owed > 0 && <div className="font-semibold tabular-nums text-danger md:w-24 md:text-end">{fmt(owed)}</div>}
      </Button>
    </li>
  );
}
