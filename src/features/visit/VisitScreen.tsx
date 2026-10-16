import { Breadcrumbs, Card, Chip, Link } from "@heroui/react";
import { ArrowLeftRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { payerOf, planOf } from "../../domain/lookup";
import { fmt } from "../../domain/money";
import { dedPool } from "../../domain/pricing";
import { payerChangeable } from "../../domain/stories";
import type { StoryUiCtx } from "../../domain/types";
import { visitNo } from "../../domain/visits";
import { useW } from "../../store/hooks";
import { useUi } from "../../store/ui";
import { PayerButton } from "../../ui/PayerButton";
import { WalletChip } from "../../ui/WalletChip";
import { beginPayerStory } from "../stories/PayerStory";
import { WalletSection } from "../wallet/WalletSection";
import { StoryCard } from "./StoryCard";
import { StoryStrip } from "./StoryStrip";
import { VisitTimeline } from "./VisitTimeline";

/* v3 renderVisit() (line 3738): who, which visit, who pays — then the stories and what has happened */
export function VisitScreen() {
  const { t } = useTranslation();
  const w = useW();
  const { caseId, goHome, openPatient, walletOpen, drawer, refund, replace } = useUi();
  const c = w.cases.find((x) => x.id === caseId);
  if (!c) return null;
  const p = w.patients[c.mrn]!;
  const others = w.cases.filter((x) => x.mrn === c.mrn && x.id !== c.id);
  const plan = planOf(w, c);
  const pool = dedPool(w, c);
  const canChange = payerChangeable(c);
  const ui: StoryUiCtx = {
    drawer: drawer ? { caseId: drawer.caseId, credit: !!drawer.credit, refund: !!drawer.refund, refundDiff: !!drawer.refundDiff } : null,
    refundInvoiceId: refund ? refund.id : null,
    replaceCaseId: replace ? replace.caseId : null,
  };

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs>
        <Breadcrumbs.Item onPress={goHome}>{t("patient.home")}</Breadcrumbs.Item>
        <Breadcrumbs.Item onPress={() => openPatient(p.mrn)}>{p.name}</Breadcrumbs.Item>
        <Breadcrumbs.Item>{c.visitType} · {c.clinic} · {c.date}</Breadcrumbs.Item>
      </Breadcrumbs>

      <Card className="gap-0 p-0">
        <div className="flex flex-wrap items-center gap-4 p-4">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-vida-navy">{p.name}</h1>
            <span className="text-sm text-muted">
              {t("patient.idLine", { mrn: p.mrn, age: p.age, gender: p.gender, mobile: p.mobile })}
              {others.length > 0 && <> · <Link className="cursor-pointer text-sm" onPress={() => openPatient(p.mrn)}>{t("visit.otherVisits", { count: others.length })}</Link></>}
            </span>
          </div>
          <div className="flex-1" />
          {plan && (
            <div className="text-end">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">{t("visit.dedLeft")}</div>
              <div className="font-bold tabular-nums text-vida-navy" data-testid="ded-left">{fmt(pool.left)}</div>
            </div>
          )}
          <WalletChip mrn={p.mrn} />
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-border bg-default/40 px-4 py-2 text-sm">
          <span><b>{c.clinic}</b> · {t("visit.dr", { doctor: c.doctor })}</span>
          <span data-testid="visit-ctx">
            {c.visitType} · {c.date} {c.arrived}{c.slot && <> · {t("visit.appointment")} <b>{c.slot}</b></>} · <b>{visitNo(c)}</b>
          </span>
          {c.interbranch && (
            <Chip size="sm" variant="soft" className="bg-vida-purple-soft text-vida-purple" data-testid="received-from">
              <ArrowLeftRight className="size-3" /> {t("visit.receivedFrom")} <b>{c.fromBranch}</b>
            </Chip>
          )}
          <div className="flex-1" />
          {/* the payer shows its policy; the arrow is the way into the Payer story, and only while nothing has been charged */}
          <PayerButton mrn={c.mrn} payer={payerOf(w, c)} testId="visit-payer" changeLabel={t("visit.changePayer")}
            lockedLabel={t("visit.payerLocked")} onChange={canChange ? () => beginPayerStory(c.id) : null} />
        </div>
      </Card>

      {walletOpen && <WalletSection mrn={c.mrn} caseId={c.id} />}

      <StoryStrip c={c} ui={ui} />
      <StoryCard c={c} ui={ui} />
      <VisitTimeline c={c} />
    </div>
  );
}
