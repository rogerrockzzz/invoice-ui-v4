import { Breadcrumbs, Button, Card, Chip, Disclosure, Tabs } from "@heroui/react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { visitsOf } from "../../domain/lookup";
import { fmt } from "../../domain/money";
import { pendingVisits } from "../../domain/steps";
import { activePayerOf } from "../../domain/visits";
import { useW } from "../../store/hooks";
import { useUi, type PendView } from "../../store/ui";
import { ActionTile } from "../../ui/ActionTile";
import { WalletChip } from "../../ui/WalletChip";
import { ProfilePayer, startProfilePayer } from "./ProfilePayer";
import { WalletSection } from "../wallet/WalletSection";
import { VisitsList } from "./VisitsList";
import { PatientInvoicesCard, PackageItemsCard } from "./PatientCards";

/* v3 renderPatient() (line 3583): the patient profile — the visits, newest first */
export function PatientScreen() {
  const { t } = useTranslation();
  const w = useW();
  const { activeMrn, goHome, walletOpen, profPendOpen, pendView, set } = useUi();
  const p = w.patients[activeMrn!]!;
  const vs = visitsOf(w, p.mrn);
  const ap = activePayerOf(w, p);
  const plan = ap.payer.plan;
  const from = !ap.from ? "" : ap.from.kind === "profile" ? t("patient.fromProfile")
    : t(ap.from.kind === "open" ? "patient.fromOpen" : "patient.fromLast", { date: ap.from.date, at: ap.from.at });

  const pv = pendingVisits(w, p.mrn);
  const pendTotal = pv.today.length + pv.upcoming.length + pv.earlier.length;
  const views: Record<PendView, [string, typeof pv.today, string]> = {
    today: [t("patient.today"), pv.today, t("patient.noneToday")],
    upcoming: [t("patient.upcoming"), pv.upcoming, t("patient.noneUpcoming")],
    past: [t("patient.past"), pv.earlier, t("patient.nonePast")],
  };

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs>
        <Breadcrumbs.Item onPress={goHome}>{t("patient.home")}</Breadcrumbs.Item>
        <Breadcrumbs.Item>{p.name}</Breadcrumbs.Item>
      </Breadcrumbs>

      <Card className="gap-0 p-0">
        <div className="flex flex-wrap items-center gap-4 p-4">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-vida-navy">{p.name}</h1>
            <span className="text-sm text-muted">{t("patient.idLine", { mrn: p.mrn, age: p.age, gender: p.gender, mobile: p.mobile })}</span>
          </div>
          <div className="flex-1" />
          <div className="text-end">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">{t("patient.visitsOnFile")}</div>
            <div className="font-bold tabular-nums text-vida-navy" data-testid="visits-on-file">{vs.length}</div>
          </div>
          <WalletChip mrn={p.mrn} />
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-border bg-default/40 px-4 py-2">
          <span className="text-sm text-muted">{t("patient.activePayer")}{from && ` · ${from}`}</span>
          <div className="flex-1" />
          {p.payers.length > 1 && <span className="text-sm text-muted">{t("patient.payersOnFile", { count: p.payers.length })}</span>}
          <Button variant="outline" aria-label={t("patient.changeTitle")} className="h-auto gap-3 rounded-xl bg-surface px-3 py-1.5" onPress={() => startProfilePayer(p.mrn)}>
            <span className="text-end leading-tight" data-testid="payer-button">
              <b className="block text-sm text-accent">{ap.payer.label}</b>
              <span className="text-[11px] text-muted">
                {plan
                  ? t("patient.planLine", { ded: Math.round(plan.deductiblePct * 100), cap: fmt(Math.min(plan.visitCap, plan.annualLeft)) }) +
                    (plan.discountPct ? t("patient.planDiscount", { pct: Math.round(plan.discountPct * 100) }) : "")
                  : t("patient.noPolicy")}
              </span>
            </span>
            <span className="flex items-center text-xs">{t("patient.change")}<ChevronDown className="size-3" /></span>
          </Button>
        </div>
      </Card>

      <ProfilePayer mrn={p.mrn} />
      {walletOpen && <WalletSection mrn={p.mrn} caseId={vs[0] ? vs[0].id : null} />}

      {/* every pending action for this patient, including visits booked for later */}
      <Card className="gap-0 p-0">
        <Disclosure isExpanded={profPendOpen} onExpandedChange={(v) => set({ profPendOpen: v })}>
          <Disclosure.Heading>
            <Disclosure.Trigger className="flex w-full items-center justify-start gap-2 px-4 py-3 text-start">
              <h2 className="text-xs font-bold uppercase tracking-wider text-vida-navy">{t("patient.pending")}</h2>
              <span className="ms-auto text-xs text-muted">
                {pendTotal
                  ? profPendOpen ? t("patient.pendingCount", { count: pendTotal })
                    : t("patient.pendingCountShut", { count: pendTotal, today: pv.today.length, upcoming: pv.upcoming.length })
                  : t("patient.nothingPending")}
              </span>
              <Disclosure.Indicator className="ms-2"><ChevronDown className="size-4" /></Disclosure.Indicator>
            </Disclosure.Trigger>
          </Disclosure.Heading>
          <Disclosure.Content>
            <div className="px-4 pb-4">
              <Tabs selectedKey={pendView} onSelectionChange={(k) => set({ pendView: k as PendView })}>
                <Tabs.ListContainer>
                  <Tabs.List aria-label={t("patient.pending")}>
                    {(Object.keys(views) as PendView[]).map((k) => (
                      <Tabs.Tab key={k} id={k}>
                        {views[k][0]}
                        <Chip size="sm" variant="soft" className="ms-2">{views[k][1].length}</Chip>
                        <Tabs.Indicator />
                      </Tabs.Tab>
                    ))}
                  </Tabs.List>
                </Tabs.ListContainer>
                {(Object.keys(views) as PendView[]).map((k) => (
                  <Tabs.Panel key={k} id={k} className="flex flex-col gap-2 pt-3">
                    {!views[k][1].length && <p className="text-sm text-muted">{views[k][2]}</p>}
                    {views[k][1].map((x) => <ActionTile key={x.c.id} x={x} />)}
                  </Tabs.Panel>
                ))}
              </Tabs>
            </div>
          </Disclosure.Content>
        </Disclosure>
      </Card>

      <VisitsList mrn={p.mrn} />
      <PackageItemsCard mrn={p.mrn} />
      <PatientInvoicesCard mrn={p.mrn} />
    </div>
  );
}
