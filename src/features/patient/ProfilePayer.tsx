import { Button, Card, Checkbox, Chip } from "@heroui/react";
import { ChevronLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { payerOf, visitsOf } from "../../domain/lookup";
import { payerChangeable } from "../../domain/stories";
import { activePayerOf, visitNo } from "../../domain/visits";
import { backToChoices, draftDecide, finishEligibility, payerDraft, saveProfilePayer } from "../../store/payer";
import { useW } from "../../store/hooks";
import { useUi } from "../../store/ui";
import { useWorld } from "../../store/world";
import { StoryStepper } from "../../ui/StoryStepper";
import { NPHIES_DELAY, PayerStoryBody, type PayerRun } from "../stories/PayerStory";

/* v3 startProfilePayer() (line 4040): the profile's payer — the same flow, then which open visits take it */
export function startProfilePayer(mrn: string) {
  const w = useWorld.getState();
  const pctx = { ...payerDraft(mrn, 200, activePayerOf(w, w.patients[mrn]!).payer.id), forPatient: true };
  useUi.getState().set({ profPayer: { mrn, decision: null, apply: {}, pctx } });
  setTimeout(() => useUi.getState().upd((s) => { if (s.profPayer && s.profPayer.mrn === mrn) finishEligibility(s.profPayer.pctx); }), NPHIES_DELAY);
}

/* v3 renderProfilePayer() (line 4052) */
export function ProfilePayer({ mrn }: { mrn: string }) {
  const { t } = useTranslation();
  const w = useW();
  const { profPayer: pp, upd, set } = useUi();
  const actW = useWorld((s) => s.actW);
  if (!pp || pp.mrn !== mrn) return null;
  const p = w.patients[mrn]!;
  const cancel = () => set({ profPayer: null });
  const run: PayerRun = (fn) => upd((s) => {
    const x = s.profPayer;
    if (!x || !x.pctx.payerStory || !fn(x.pctx.payerStory)) return;
    x.decision = draftDecide(x.pctx);
    /* open visits that can still change payer are ticked; the rest are shown, locked */
    visitsOf(w, mrn).filter((c) => !c.closed && payerChangeable(c) && !c.fromPackage).forEach((c) => { x.apply[c.id] = true; });
  });
  const pos = pp.decision ? { index: 3, skipped: pp.decision.form ? [] : [2] } : { index: (pp.pctx.payerStory || { stage: 1 }).stage - 1, skipped: [] };
  const recheck = () => startProfilePayer(mrn);

  if (!pp.decision)
    return (
      <Card className="gap-3 border-s-4 border-s-accent p-5" data-testid="profile-payer">
        <StoryStepper id="payer" pos={pos} />
        <Chip size="sm" variant="soft" color="accent" className="self-start">{t("story.payer.title")}</Chip>
        {pp.pctx.payerStory && <PayerStoryBody ctx={pp.pctx} ps={pp.pctx.payerStory} run={run} recheck={recheck} />}
        <div><Button variant="ghost" onPress={cancel}>{t("payer.profile.cancel")}</Button></div>
      </Card>
    );

  const d = pp.decision, ch = d.choice;
  const open = visitsOf(w, mrn).filter((c) => !c.closed && !c.fromPackage);
  const save = () => {
    const ids = Object.keys(pp.apply).map(Number);
    actW((dw, fx) => saveProfilePayer(dw, mrn, d, ids, fx));
    set({ profPayer: null });
  };
  return (
    <Card className="gap-3 border-s-4 border-s-accent p-5" data-testid="profile-payer">
      <StoryStepper id="payer" pos={pos} />
      <Chip size="sm" variant="soft" color="accent" className="self-start">{t("story.payer.title")}</Chip>
      <h2 className="text-lg font-bold text-vida-navy">{t("payer.profile.q", { label: ch.label, first: p.name.split(" ")[0] })}</h2>
      <p className="text-sm text-muted">
        {d.form ? `${t(d.form.type === "Company" ? "done.payer.policy" : "done.payer.reference")} ${d.form.policyNo}${d.form.validTo ? t("hist.validTo", { to: d.form.validTo }) : ""}` : t("done.payer.cash")}
        {ch.unverified ? t("payer.notOnNphiesLower") : ""}
      </p>
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted">{t("payer.profile.applyHead")}</h3>
      {open.length ? (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {open.map((c) => {
            const ok = payerChangeable(c);
            return (
              <li key={c.id} className="flex items-center gap-3 px-3 py-2">
                <Checkbox isSelected={ok && !!pp.apply[c.id]} isDisabled={!ok} aria-label={t("payer.profile.apply", { visit: visitNo(c) })}
                  onChange={(on) => upd((s) => { if (on) s.profPayer!.apply[c.id] = true; else delete s.profPayer!.apply[c.id]; })}>
                  <Checkbox.Content><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control></Checkbox.Content>
                </Checkbox>
                <span className="min-w-0 flex-1"><b className="block text-sm">{c.visitType} · {c.clinic}</b>
                  <span className="text-xs text-muted">{t("payer.profile.visitLine", { no: visitNo(c), date: c.date, at: c.arrived, payer: payerOf(w, c).label })}</span></span>
                <Chip size="sm" variant="soft" color={ok ? "accent" : "default"}>{t(ok ? "payer.profile.canChange" : "payer.profile.invoiced")}</Chip>
              </li>
            );
          })}
        </ul>
      ) : <p className="text-sm text-muted">{t("payer.profile.noOpen")}</p>}
      <p className="text-xs text-muted">{t("payer.profile.hint")}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onPress={() => upd((s) => { s.profPayer!.decision = null; backToChoices(s.profPayer!.pctx); })}>
          <ChevronLeft className="size-4 rtl:rotate-180" />{t("payer.profile.change")}
        </Button>
        <Button variant="primary" className="bg-success text-success-foreground" onPress={save}>{t("payer.profile.save")}</Button>
        <Button variant="ghost" onPress={cancel}>{t("payer.profile.cancel")}</Button>
      </div>
    </Card>
  );
}
