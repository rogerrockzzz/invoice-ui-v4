import { Button, Card, Checkbox, Chip, Input, Label, Spinner, Table, TextField } from "@heroui/react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { payerOf } from "../../domain/lookup";
import { fmt } from "../../domain/money";
import * as P from "../../domain/payers";
import { priceLines } from "../../domain/pricing";
import type { Line, Msg, PayerStory, Plan, Visit, World } from "../../domain/types";
import { applyPayer, finishEligibility, startPayerStory } from "../../store/payer";
import { useW } from "../../store/hooks";
import { useWorld } from "../../store/world";
import { M } from "../../ui/Rich";

/* The payer story (v3 renderPayerStory, line 2319): NPHIES eligibility → choose → policy details → payer set.
   The same card runs on a visit, on the walk-in's visit-to-be and on the profile (v3 payerDraft). */

/* NPHIES answers a moment after the request (v3 setTimeout 1100) */
export const NPHIES_DELAY = 1100;

/* v3 startPayerStory(), from the visit header's payer chip */
export function beginPayerStory(caseId: number) {
  let ok = false;
  useWorld.getState().act(caseId, (w, c, fx) => { ok = startPayerStory(w, c, fx); });
  if (ok) setTimeout(() => useWorld.getState().act(caseId, (_w, c) => finishEligibility(c)), NPHIES_DELAY);
}

export interface PayerCtx { mrn: string; payerId: string | null; consult: Line; dedUsed: number; forPatient?: boolean }
/* run a change on the story; returning true means the payer is decided (cash chosen, or details saved) */
export type PayerRun = (fn: (ps: PayerStory) => boolean | void) => void;

export function VisitPayerStory({ c, top }: { c: Visit; top: ReactNode }) {
  const { t } = useTranslation();
  const w = useW();
  const act = useWorld((s) => s.act);
  const run: PayerRun = (fn) => act(c.id, (dw, dc, fx) => { if (dc.payerStory && fn(dc.payerStory)) applyPayer(dw, dc, fx); });
  return (
    <Card className="gap-3 border-s-4 border-s-accent p-5" data-testid="step-card" data-step="PAYER">
      {top}
      <Chip size="sm" variant="soft" color="accent" className="self-start">{t("story.payer.title")}</Chip>
      {c.payerStory ? <PayerStoryBody ctx={c} ps={c.payerStory} run={run} recheck={() => beginPayerStory(c.id)} />
        : <h2 className="text-lg font-bold text-vida-navy">{payerOf(w, c).label}</h2>}
    </Card>
  );
}

const estimate = (w: World, ctx: PayerCtx, plan: Plan | null) => priceLines(w, ctx as unknown as Visit, [ctx.consult], plan || null).patient;

export function PayerStoryBody({ ctx, ps, run, recheck }: { ctx: PayerCtx; ps: PayerStory; run: PayerRun; recheck: () => void }) {
  const { t } = useTranslation();
  const w = useW();
  const p = w.patients[ctx.mrn]!;
  if (ps.stage === 1)
    return (
      <div className="flex flex-col gap-2" data-testid="payer-stage" data-stage="1">
        <h2 className="text-lg font-bold text-vida-navy">{t("payer.checking")}</h2>
        <p className="text-sm text-muted">{t("payer.lookingUp", { name: p.name })}</p>
        <div className="flex items-center gap-2 rounded-xl bg-default/50 px-3 py-2 text-sm"><Spinner size="sm" /> {t("payer.sentAt", { at: ps.at })}</div>
      </div>
    );
  if (ps.stage === 2) {
    const { ins, cash } = P.payerOptions(w, ctx.mrn, ps);
    const ok = ins.filter((x) => x.status === "Eligible").length;
    return (
      <div className="flex flex-col gap-3" data-testid="payer-stage" data-stage="2">
        <h2 className="text-lg font-bold text-vida-navy">{ctx.forPatient ? t("payer.whoFor", { first: p.name.split(" ")[0] }) : t("payer.who")}</h2>
        <p className="text-sm text-muted">
          <M msg={{ k: "payer.checkedAt", p: { at: ps.at, count: ok, none: ins.length ? "" : { k: "payer.noCoverage" } } }} />{" "}
          <Button size="sm" variant="ghost" className="h-auto min-w-0 px-1 text-accent" onPress={recheck}>{t("payer.checkAgain")}</Button>
        </p>
        {ins.length > 0 && <Section title={t("payer.eligibleHead")}>{ins.map((o) => <ChoiceCard key={o.id} ctx={ctx} o={o} ps={ps} run={run} />)}</Section>}
        <Section title={t("payer.notListed")}>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3">
            <span className="min-w-0 flex-1"><b className="block text-sm">{t("payer.manual")}</b><span className="text-xs text-muted">{t("payer.manualSub")}</span></span>
            <Button size="sm" variant="primary" onPress={() => run((s) => { P.startManual(s); })}>{t("payer.enterManually")}</Button>
          </div>
        </Section>
        <Section title={t("payer.selfPay")}><ChoiceCard ctx={ctx} o={cash} ps={ps} run={run} /></Section>
      </div>
    );
  }
  if (ps.stage === 3 && ps.form && ps.choice) return <PolicyDetails ps={ps} run={run} />;
  return null;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="flex flex-col gap-2"><h3 className="text-[11px] font-bold uppercase tracking-wider text-muted">{title}</h3>{children}</section>;
}

/* v3 payerChoiceCard() (line 2299) */
function ChoiceCard({ ctx, o, ps, run }: { ctx: PayerCtx; o: P.PayerOption; ps: PayerStory; run: PayerRun }) {
  const { t } = useTranslation();
  const w = useW();
  const cur = o.id === ctx.payerId;
  const bad = !!o.status && o.status !== "Eligible";
  const open = ps.tob === o.id;
  return (
    <div className={`flex flex-col gap-2 rounded-xl border p-3 ${bad ? "border-danger/30 bg-danger/5" : cur ? "border-accent/50" : "border-border"}`} data-testid={`payer-option-${o.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1"><b className="block text-sm">{o.label}</b><span className="text-xs text-muted"><M msg={o.sub} /></span></span>
        {o.status && <Chip size="sm" variant="soft" color={bad ? "danger" : "success"}>{o.status}{o.isNew ? t("payer.new") : ""}</Chip>}
        {o.kind && !o.status && <Chip size="sm" variant="soft">{o.kind}</Chip>}
        {o.unverified && <Chip size="sm" variant="soft" color="warning">{t("payer.notOnNphies")}</Chip>}
        {cur && <Chip size="sm" variant="soft" color="accent">{t("payer.current")}</Chip>}
        <span className="text-xs text-muted">{bad ? o.reason || "" : <M msg={{ k: "payer.consultEst", p: { amount: fmt(estimate(w, ctx, o.plan)) } }} />}</span>
        {!bad && (
          <Button size="sm" variant={cur ? "outline" : "primary"} aria-label={`${t(cur ? "payer.keep" : "payer.choose")} ${o.label}`}
            onPress={() => run((s) => { const opt = P.payerOptions(w, ctx.mrn, s).all.find((x) => x.id === o.id)!; return P.choosePayer(s, opt); })}>
            {t(cur ? "payer.keep" : "payer.choose")}
          </Button>
        )}
      </div>
      {o.plan && (
        <>
          <TobToggle open={open} onPress={() => run((s) => { s.tob = s.tob === o.id ? null : o.id; })} />
          {open && <Tob plan={o.plan} label={o.label} />}
        </>
      )}
    </div>
  );
}

function TobToggle({ open, onPress }: { open: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <Button size="sm" variant="ghost" className="self-start text-accent" aria-expanded={open} onPress={onPress}>
      {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4 rtl:rotate-180" />}{t("payer.tob")}
    </Button>
  );
}

/* v3 tobHtml() (line 2280) */
function Tob({ plan, label }: { plan: Plan; label: string }) {
  const { t } = useTranslation();
  const rows = P.tobRows(plan, label);
  return (
    <Table data-testid="tob">
      <Table.ScrollContainer>
        <Table.Content aria-label={t("payer.tob")}>
          <Table.Header>
            {(["benefit", "coverage", "patientPays", "limit", "preApproval"] as const).map((k, i) => <Table.Column key={k} isRowHeader={i === 0}>{t(`tob.col.${k}`)}</Table.Column>)}
          </Table.Header>
          <Table.Body>
            {rows.map((r, i) => (
              <Table.Row key={i}>{r.map((m: Msg, j) => <Table.Cell key={j}>{j === 0 ? <b><M msg={m} /></b> : <M msg={m} />}</Table.Cell>)}</Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}

/* v3 renderPayerStory() stage 3 (line 2369): the policy details — filled from NPHIES, or found in the payer list */
function PolicyDetails({ ps, run }: { ps: PayerStory; run: PayerRun }) {
  const { t } = useTranslation();
  const f = ps.form!, ch = ps.choice!;
  const internal = P.payerIsInternal(ch);
  const manual = !!ch.manual;
  const ok = P.payerReady(ps);
  const matches = manual ? P.payerMatches(ps) : null;
  const fld = (k: P.PolicyField, label: string, o: { req?: boolean; ph?: string; type?: string } = {}) => (
    <TextField key={k} value={f[k] || ""} onChange={(v) => run((s) => { P.editPayerField(s, k, v); })} isRequired={o.req} type={o.type}>
      <Label>{label}</Label>
      <Input placeholder={o.ph || ""} data-f={k} />
    </TextField>
  );
  return (
    <div className="flex flex-col gap-3" data-testid="payer-stage" data-stage="3">
      <h2 className="text-lg font-bold text-vida-navy">{ch.id ? t("payer.detailsOf", { label: ch.label }) : t("payer.find")}</h2>
      <p className="text-sm text-muted">{t(f.fromNphies ? "payer.subNphies" : manual && !ch.id ? "payer.subManual" : internal ? "payer.subInternal" : "payer.subCard")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField isDisabled value={f.type}>
          <Label>{t("payer.f.type")}</Label>
          <Input placeholder={t("payer.f.typePh")} />
        </TextField>
        <div className="flex items-end">{ch.plan && <TobToggle open={!!ps.tob2} onPress={() => run((s) => { s.tob2 = !s.tob2; })} />}</div>
        {fld("group", t("payer.f.group"), { req: true, ph: manual ? t("payer.f.groupPh") : "" })}
        {fld("contract", t("payer.f.contract"), { req: true, ph: manual ? t("payer.f.contractPh") : "" })}
        {fld("policy", t("payer.f.policy"), { req: true, ph: manual ? t("payer.f.policyPh") : "" })}
        <div className="flex items-end">{manual && ch.id && <Chip size="sm" variant="soft" color={ch.unverified ? "warning" : "default"}>{ch.kind}{ch.unverified ? t("payer.notOnNphiesLower") : ""}</Chip>}</div>
        {matches && (
          <div className="sm:col-span-2" data-testid="payer-matches">
            {matches.length ? (
              <div className="flex flex-col gap-1 rounded-xl border border-border p-2">
                <span className="px-1 text-[11px] font-bold uppercase tracking-wider text-muted">{t("payer.matching")}</span>
                {matches.map((x) => (
                  <Button key={x.id} variant="ghost" className="h-auto justify-start gap-3 whitespace-normal py-1.5 text-start font-normal" data-pick={x.id}
                    onPress={() => run((s) => { P.pickDirectory(s, x.id); })}>
                    <span className="min-w-0 flex-1"><b className="block text-sm">{x.label}</b><span className="text-xs text-muted">{x.group} · {x.contract} · {x.policy}</span></span>
                    <em className="text-xs text-muted">{x.kind}</em>
                  </Button>
                ))}
              </div>
            ) : <p className="text-sm text-muted">{t("payer.noMatch")}</p>}
          </div>
        )}
        {fld("policyNo", internal ? t("payer.f.reference") : t("payer.f.policyNo"), { req: true, ph: internal ? "e.g. CH-2026-0412" : "" })}
        {fld("subPolicy", t("payer.f.subPolicy"))}
        {fld("cardId", t("payer.f.cardId"))}
        {fld("validTo", t("payer.f.validTo"), { type: "date" })}
        {fld("holderCode", t("payer.f.holderCode"))}
        {fld("holder", t("payer.f.holder"))}
        <Checkbox isSelected={f.active} onChange={(v) => run((s) => { s.form!.active = v; })}>
          <Checkbox.Content><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>{t("payer.f.active")}</Checkbox.Content>
        </Checkbox>
      </div>
      {ps.tob2 && ch.plan && <Tob plan={ch.plan} label={ch.label} />}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onPress={() => run((s) => { s.stage = 2; })}><ChevronLeft className="size-4 rtl:rotate-180" />{t("step.back")}</Button>
        <Button variant="primary" className="bg-success text-success-foreground" isDisabled={!ok} onPress={() => run((s) => P.payerReady(s))} data-testid="payer-save">
          {ch.id ? t("payer.save", { label: ch.label }) : t("payer.savePick")}
        </Button>
      </div>
    </div>
  );
}
