import { Button, Card, Chip } from "@heroui/react";
import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { creditInvoices, liveInvoices, refundable } from "../../domain/lines";
import { firstName } from "../../domain/lookup";
import { fmt } from "../../domain/money";
import { invoiceReplace, packageItemsLeft } from "../../domain/replace";
import { activeStory, isVisitStep, mainStory, storyStage, type StoryId } from "../../domain/stories";
import { nextStep } from "../../domain/steps";
import type { StoryDone, StoryUiCtx, Visit } from "../../domain/types";
import { switchStory } from "../../store/actions";
import { useW } from "../../store/hooks";
import { useUi } from "../../store/ui";
import { useWorld } from "../../store/world";
import { InvoiceLink } from "../../ui/InvoiceLink";
import { StepCard } from "../../ui/StepCard";
import { StoryStepper } from "../../ui/StoryStepper";
import { AddOrdersStory } from "../stories/AddOrdersStory";
import { CreditStory } from "../stories/CreditStory";
import { VisitPayerStory } from "../stories/PayerStory";

/* stories that are built in a later checkpoint or milestone */
const LATER: Partial<Record<StoryId, string>> = { refund: "M2", replace: "M2", package: "M3" };

/* v3 renderStoryCard() (line 2142): the active story's stages, then its card */
export function StoryCard({ c, ui }: { c: Visit; ui: StoryUiCtx }) {
  const w = useW();
  const id = activeStory(w, c);
  const done = (c.storyDone || {})[id];
  const stages = (sid: StoryId) => <StoryStepper id={sid} pos={storyStage(w, c, sid, ui)} />;
  if (id === "pkgvisit" || id === "orders" || (id === "replace" && c.bill && c.bill.replacing))
    return <StepCard c={c} s={nextStep(w, c)} top={stages(id)} />;
  if (id === "visit") {
    const st = nextStep(w, c);
    return isVisitStep(w, c, st) ? <StepCard c={c} s={st} top={stages(id)} /> : <VisitDoneCard c={c} top={stages(id)} />;
  }
  if (done) return <DoneCard c={c} id={id} done={done} top={stages(id)} />;
  if (id === "credit") return <CreditStory c={c} top={stages(id)} />;
  if (id === "payer") return <VisitPayerStory c={c} top={stages(id)} />;
  if (id === "addorders") return <AddOrdersStory c={c} top={stages(id)} />;
  if (LATER[id]) return <LaterCard id={id} when={LATER[id]!} top={stages(id)} />;
  return <StepCard c={c} s={nextStep(w, c)} top={stages(mainStory(w, c))} />;
}

/* v3 renderVisitDoneCard() (line 2163) */
function VisitDoneCard({ c, top }: { c: Visit; top: ReactNode }) {
  const { t } = useTranslation();
  const w = useW();
  const act = useWorld((s) => s.act);
  const inv = c.invoices.find((i) => i.scope === "consult" && !i.voided && !i.replaced);
  return (
    <Card className="gap-3 border-s-4 border-s-success p-5" data-testid="step-card" data-step="VISIT_DONE">
      {top}
      <Chip size="sm" variant="soft" color="success" className="self-start">{t("story.visit.title")}</Chip>
      <h2 className="text-lg font-bold text-vida-navy">{t("visit.doneQ", { first: firstName(w, c) })}</h2>
      <p className="text-sm text-muted">
        {inv ? <><InvoiceLink id={inv.id} /> · {fmt(inv.patient)} · {inv.via || ""}</> : t("visit.consultBilled")}
        {c.clinical && t("visit.doctorStartedAt", { at: c.clinical.at })}
      </p>
      <div>
        <Button variant="primary" onPress={() => act(c.id, (dw, dc, fx) => switchStory(dw, dc, "orders", activeStory(dw, dc), fx))}>
          {t("visit.goTo", { story: t("story.orders.title") })}
        </Button>
      </div>
    </Card>
  );
}

/* v3 renderDoneCard() (line 2796): a finished story shows its result until you leave it */
function DoneCard({ c, id, done, top }: { c: Visit; id: StoryId; done: StoryDone; top: ReactNode }) {
  const { t } = useTranslation();
  const w = useW();
  const act = useWorld((s) => s.act);
  const { set, openVisit } = useUi();
  const more = ({
    refund: liveInvoices(c).some((i) => refundable(w, i)), replace: liveInvoices(c).some((i) => invoiceReplace(w, c, i)),
    package: packageItemsLeft(w, c.mrn).length > 0, credit: creditInvoices(w, c.mrn).length > 0, addorders: true,
  } as Partial<Record<StoryId, boolean>>)[id];
  const main = mainStory(w, c);
  const toMain = () => act(c.id, (dw, dc, fx) => switchStory(dw, dc, main, activeStory(dw, dc), fx));
  const again = () => act(c.id, (_w, dc) => {
    delete dc.storyDone![id];
    if (id === "package") dc.pkgStory = null;
    if (id === "addorders") dc.addStory = null;
  });
  return (
    <Card className="gap-3 border-s-4 border-s-success p-5" data-testid="step-card" data-step="STORY_DONE">
      {top}
      <Chip size="sm" variant="soft" color="success" className="self-start">{t(`story.${id}.title`)}</Chip>
      <h2 className="text-lg font-bold text-vida-navy">{done.title}</h2>
      <p className="text-sm text-muted">{done.sub || ""}</p>
      <div className="flex flex-wrap gap-2">
        {done.visitId && <Button variant="primary" onPress={() => openVisit(done.visitId!, c.mrn)}>{t("done.openVisit")}</Button>}
        {done.refundInvoiceId && <Button variant="primary" onPress={() => set({ invPop: done.refundInvoiceId! })}>{t("done.viewRefund", { id: done.refundInvoiceId })}</Button>}
        {id === "refund" && <Button variant="outline" onPress={() => act(c.id, (_w, dc) => { delete dc.storyDone!.refund; })}>{t("done.allInvoices")}</Button>}
        {more && <Button variant="outline" onPress={again}>{t(`done.again.${id}`)}</Button>}
        <Button variant={done.visitId ? "outline" : "primary"} onPress={toMain}>{t("visit.backTo", { story: t(`story.${main}.title`) })}</Button>
      </div>
    </Card>
  );
}

/* a story whose work arrives in a later checkpoint: its place and stages are shown, the work is not */
function LaterCard({ id, when, top }: { id: StoryId; when: string; top: ReactNode }) {
  const { t } = useTranslation();
  return (
    <Card className="gap-3 border-s-4 border-s-border p-5" data-testid="step-card" data-step="LATER">
      {top}
      <Chip size="sm" variant="soft" className="self-start">{t(`story.${id}.title`)}</Chip>
      <h2 className="flex items-center gap-2 text-lg font-bold text-vida-navy"><Lock className="size-4" /> {t("app.comingSoon", { when })}</h2>
      <p className="text-sm text-muted">{t("visit.laterSub", { story: t(`story.${id}.title`) })}</p>
    </Card>
  );
}
