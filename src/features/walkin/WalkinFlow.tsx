import { Button, Card, Chip } from "@heroui/react";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CLINICS, CONSULT_FEES, DOCTORS, VISIT_TYPES } from "../../domain/constants";
import { payerOf } from "../../domain/lookup";
import { fmt, round2 } from "../../domain/money";
import { cartItems, catPrice } from "../../domain/payers";
import { priceLines } from "../../domain/pricing";
import type { Line, Visit } from "../../domain/types";
import { freeSlots } from "../../domain/visits";
import { backToChoices, createWalkinVisit, draftDecide, finishEligibility, payerDraft } from "../../store/payer";
import { useW } from "../../store/hooks";
import { useUi, type WalkinUi } from "../../store/ui";
import { useWorld } from "../../store/world";
import { M } from "../../ui/Rich";
import { PickSelect } from "../../ui/PickSelect";
import { StoryStepper } from "../../ui/StoryStepper";
import { NPHIES_DELAY, PayerStoryBody, type PayerRun } from "../stories/PayerStory";
import { OrderPicker } from "./OrderPicker";

/* v3 startWalkin() (line 3862): the patient was chosen in the search, so the story opens on its second stage */
export function startWalkin(mrn: string) {
  useUi.getState().set({
    walkin: { stage: 2, mrn, type: "Consultation", clinic: "PAEDIATRICS", doctor: "LINA FAROUK", slot: null, cart: { sel: {}, q: "" }, pctx: null, payerDecision: null, createdId: null },
    homeSel: mrn, homePanel: "walkin", screen: "home",
  });
}
/* v3 startWalkinPayer() (line 4104): the payer story on a stand-in for the visit-to-be */
function startWalkinPayer(s: { walkin: WalkinUi | null }, activePayerId: string | null) {
  const d = s.walkin!;
  const fee = CONSULT_FEES[d.clinic] || 200;
  d.pctx = payerDraft(d.mrn, d.type === "Procedure only" ? 0 : fee, activePayerId);
  d.payerDecision = null;
  const at = d.pctx.payerStory!.at, mrn = d.mrn;
  setTimeout(() => useUi.getState().upd((x) => {
    const p = x.walkin && x.walkin.mrn === mrn ? x.walkin.pctx : null;
    if (p && p.payerStory && p.payerStory.at === at) finishEligibility(p);
  }), NPHIES_DELAY);
}

/* v3 renderWalkin() (line 3868): patient → visit details → orders (optional) → payer → review → visit created */
export function WalkinFlow() {
  const { t } = useTranslation();
  const w = useW();
  const { walkin: d, upd, set, openVisit } = useUi();
  const actW = useWorld((s) => s.actW);
  if (!d) return null;
  const chosen = w.patients[d.mrn]!;
  const fee = CONSULT_FEES[d.clinic] || 200;
  const slots = freeSlots(w, d.doctor);
  const slot = d.slot && slots.includes(d.slot) ? d.slot : slots[0] || null; /* first free slot, unless one is chosen */
  const items = cartItems(d.cart);
  const edit = (fn: (x: WalkinUi) => void) => upd((s) => { if (s.walkin) fn(s.walkin); });
  const next = () => upd((s) => {
    const x = s.walkin!;
    if (x.stage === 2) x.slot = slot;
    x.stage++;
    /* once a payer has been chosen, editing earlier stages comes straight back to the review */
    if (x.stage === 4) { if (x.payerDecision) x.stage = 5; else startWalkinPayer(s, chosen.activePayerId || null); }
  });
  /* back, one stage at a time, as far as visit details (the patient was chosen in the search) */
  const back = () => edit((x) => {
    if (x.stage === 5) { x.payerDecision = null; backToChoices(x.pctx); x.stage = 4; } else x.stage = Math.max(2, x.stage - 1);
  });
  const goEdit = (to: number) => edit((x) => { if (to === 4) { x.payerDecision = null; backToChoices(x.pctx); } x.stage = to; });

  let body: ReactNode = null;
  if (d.stage === 2) {
    body = (
      <>
        <h2 className="text-lg font-bold text-vida-navy">{t("walkin.whatQ")}</h2>
        <p className="text-sm text-muted" data-testid="walkin-sub">{chosen.name} · MRN {chosen.mrn}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <PickSelect label={t("walkin.type")} value={d.type} options={VISIT_TYPES} onChange={(v) => edit((x) => { x.type = v; })} />
          <PickSelect label={t("walkin.clinic")} value={d.clinic} options={CLINICS} onChange={(v) => edit((x) => { x.clinic = v; })} />
          <PickSelect label={t("walkin.doctor")} value={d.doctor} options={DOCTORS} onChange={(v) => edit((x) => { x.doctor = v; })} />
          <div className="flex flex-col gap-1">
            <PickSelect label={t("walkin.slot")} value={slot || ""} options={slots} isDisabled={!slots.length} placeholder={t("walkin.noSlots")}
              onChange={(v) => edit((x) => { x.slot = v; })} />
            <span className="text-xs text-muted">{t("walkin.freeSlots", { count: slots.length, doctor: d.doctor })}</span>
          </div>
        </div>
        <p className="text-xs text-muted"><M msg={{ k: "walkin.fee", p: { clinic: d.clinic, fee: fmt(fee), none: d.type === "Procedure only" ? { k: "walkin.noConsult" } : "" } }} /></p>
        <div><Button variant="primary" isDisabled={!slot} onPress={next}>{t("walkin.nextOrders")}</Button></div>
      </>
    );
  } else if (d.stage === 3) {
    body = (
      <>
        <h2 className="text-lg font-bold text-vida-navy">{t("walkin.ordersQ")}</h2>
        <p className="text-sm text-muted">{t("walkin.ordersSub")}</p>
        <OrderPicker cart={d.cart} onQuery={(q) => edit((x) => { x.cart.q = q; })}
          onToggle={(code) => edit((x) => { if (x.cart.sel[code]) delete x.cart.sel[code]; else x.cart.sel[code] = true; })} />
        {items.length > 0 && d.type !== "Procedure only" && (
          <p className="text-xs text-muted">
            {t("walkin.noDoctorHint")}{" "}
            <Button size="sm" variant="ghost" className="h-auto min-w-0 px-1 text-accent" onPress={() => edit((x) => { x.type = "Procedure only"; })}>{t("walkin.makeProc")}</Button>{" "}
            {t("walkin.noDoctorHint2")}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onPress={back}><ChevronLeft className="size-4 rtl:rotate-180" />{t("step.back")}</Button>
          <Button variant={items.length ? "primary" : "outline"} onPress={next}>
            {items.length ? t(d.payerDecision ? "walkin.nextReview" : "walkin.nextPayer", { count: items.length }) : t("walkin.skip")}
          </Button>
        </div>
      </>
    );
  } else if (d.stage === 4 && d.pctx) {
    const run: PayerRun = (fn) => upd((s) => {
      const x = s.walkin;
      if (!x || !x.pctx || !x.pctx.payerStory || !fn(x.pctx.payerStory)) return;
      x.payerDecision = draftDecide(x.pctx);
      x.stage = 5; /* on to the review */
    });
    body = (
      <>
        {d.pctx.payerStory && (
          <PayerStoryBody ctx={d.pctx} ps={d.pctx.payerStory} run={run}
            recheck={() => upd((s) => startWalkinPayer(s, chosen.activePayerId || null))} />
        )}
        <div><Button variant="outline" onPress={back}><ChevronLeft className="size-4 rtl:rotate-180" />{t("walkin.backOrders")}</Button></div>
      </>
    );
  } else if (d.stage === 5 && d.payerDecision) {
    const pd = d.payerDecision, plan = pd.choice.plan || null;
    const consult: Line | null = d.type === "Procedure only" ? null : { code: "", name: "", price: fee, ins: plan ? "approved" : "notinsured" };
    const stand = { dedUsed: 0 } as Visit;
    const lines = [...(consult ? [consult] : []), ...items.map((it): Line => ({ code: it.code, name: it.name, price: it.price, ins: "notinsured", selfPay: true }))];
    const est = priceLines(w, stand, lines, plan);
    const cEst = consult ? priceLines(w, stand, [consult], plan) : null;
    const needsAppr = !!plan && !plan.internal && !!consult;
    const kv = (k: string, v: string) => <div key={k} className="flex gap-3 text-sm"><span className="text-muted">{k}</span><b className="ms-auto text-end">{v}</b></div>;
    const sec = (title: string, stage: number, inner: ReactNode) => (
      <section className="flex flex-col gap-1 rounded-xl border border-border p-3">
        <div className="flex items-center"><b className="text-sm text-vida-navy">{title}</b>
          {stage > 0 && <Button size="sm" variant="ghost" className="ms-auto h-auto min-w-0 px-2 text-accent" aria-label={`${t("walkin.edit")} ${title}`} onPress={() => goEdit(stage)}>{t("walkin.edit")}</Button>}</div>
        {inner}
      </section>
    );
    body = (
      <>
        <h2 className="text-lg font-bold text-vida-navy">{t("walkin.reviewQ")}</h2>
        <div className="grid gap-3 md:grid-cols-2" data-testid="walkin-review">
          {sec(t("walkin.r.patient"), 0, <>{kv(t("walkin.r.name"), chosen.name)}{kv("MRN", chosen.mrn)}{kv(t("walkin.r.ageGender"), `${chosen.age} / ${chosen.gender}`)}{kv(t("walkin.r.mobile"), chosen.mobile)}</>)}
          {sec(t("walkin.r.visit"), 2, <>{kv(t("walkin.type"), d.type)}{kv(t("walkin.clinic"), d.clinic)}{kv(t("walkin.doctor"), `Dr ${d.doctor}`)}{kv(t("walkin.r.appointment"), t("walkin.r.today", { slot: d.slot || "—" }))}</>)}
          {sec(t("walkin.r.orders"), 3, items.length ? items.map((it) => kv(it.name, fmt(catPrice(it)))) : <span className="text-sm text-muted">{t("walkin.r.noOrders")}</span>)}
          {sec(t("walkin.r.payer"), 4, <>
            {kv(t("walkin.r.payer"), pd.choice.label + (pd.choice.unverified ? t("payer.notOnNphiesLower") : ""))}
            {pd.form && kv(pd.form.type === "Company" ? t("payer.f.policyNo") : t("walkin.r.reference"), pd.form.policyNo || "—")}
            {pd.form && pd.form.cardId && kv(t("walkin.r.cardId"), pd.form.cardId)}
            {pd.form && pd.form.validTo && kv(t("payer.f.validTo"), pd.form.validTo)}
            {kv(t("walkin.r.approval"), t(needsAppr ? "walkin.r.apprRequested" : plan && plan.internal ? "walkin.r.apprInternal" : "walkin.r.apprNone"))}
          </>)}
        </div>
        <div className="flex items-baseline gap-2" data-testid="walkin-est">
          <span className="text-2xl font-bold tabular-nums text-danger">{fmt(est.patient)}</span>
          <small className="text-xs text-muted">{t("walkin.estShare")}{needsAppr ? t("walkin.ifApproved") : ""}</small>
        </div>
        <p className="text-xs text-muted">
          {cEst ? t("walkin.consultEst", { amount: fmt(cEst.patient) }) : t("walkin.noConsultation")}
          {items.length > 0 && t("walkin.ordersEst", { amount: fmt(round2(est.patient - (cEst ? cEst.patient : 0))) })}
          {est.company > 0 && t("walkin.payerPays", { payer: pd.choice.label.split("·")[0]!.trim(), amount: fmt(est.company) })}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onPress={back}><ChevronLeft className="size-4 rtl:rotate-180" />{t("step.back")}</Button>
          <Button variant="primary" className="bg-success text-success-foreground" onPress={() => {
            const id = actW((dw, fx) => createWalkinVisit(dw, { mrn: d.mrn, type: d.type, clinic: d.clinic, doctor: d.doctor, slot: d.slot, payerDecision: pd,
              draftHistory: d.pctx ? d.pctx.history : [], items }, fx).id);
            edit((x) => { x.createdId = id; x.stage = 6; });
          }}>{t("walkin.create")}</Button>
        </div>
      </>
    );
  } else if (d.stage === 6) {
    const v = w.cases.find((x) => x.id === d.createdId);
    if (v) {
      const added = v.orders.filter((o) => o.byReception);
      body = (
        <>
          <h2 className="text-lg font-bold text-vida-navy">{t("walkin.createdQ", { name: chosen.name })}</h2>
          <p className="text-sm text-muted">
            {v.visitType} · {v.clinic} · Dr {v.doctor} · {payerOf(w, v).label} · {v.slot ? t("walkin.appointmentAt", { slot: v.slot }) : v.arrived}
            {added.length > 0 && t("walkin.ordersAdded", { count: added.length })}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onPress={() => { set({ walkin: null, homePanel: null }); openVisit(v.id, v.mrn); }}>{t("walkin.open")}</Button>
            <Button variant="outline" onPress={() => startWalkin(d.mrn)}>{t("walkin.again")}</Button>
          </div>
        </>
      );
    }
  }
  return (
    <Card className="gap-3 border-s-4 border-s-accent p-5" data-testid="walkin">
      <StoryStepper id="walkin" pos={{ index: d.stage - 1, skipped: [] }} />
      <Chip size="sm" variant="soft" color="accent" className="self-start">{t("story.walkin.title")}</Chip>
      {body}
    </Card>
  );
}
