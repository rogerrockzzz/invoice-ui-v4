import { Button, Card, Chip, Label, SearchField } from "@heroui/react";
import { ChevronDown, ChevronRight, Clock, Info, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { visitsOf } from "../../domain/lookup";
import { pendingVisits } from "../../domain/steps";
import type { Patient, World } from "../../domain/types";
import { useW } from "../../store/hooks";
import { useUi } from "../../store/ui";
import { ActionTile } from "../../ui/ActionTile";
import { ComingSoon } from "../../ui/ComingSoon";
import { T } from "../../ui/Rich";
import { EmptyState } from "../../ui/EmptyState";
import { startWalkin, WalkinFlow } from "../walkin/WalkinFlow";

/* v3 renderHome() (line 3476): find the patient; everything else starts from the patient */
export function searchPatients(w: World, raw: string) {
  const q = raw.trim().toLowerCase();
  /* a doctor can be typed with or without the "Dr" */
  const dq = q.replace(/^dr\.?\s*/, "");
  const byDoctor = (p: Patient) => (dq.length >= 2 ? visitsOf(w, p.mrn).filter((c) => (c.doctor || "").toLowerCase().includes(dq)) : []);
  const found = q
    ? Object.values(w.patients).filter((p) =>
        p.name.toLowerCase().includes(q) || p.mrn.includes(q) ||
        p.mobile.replace(/\s/g, "").includes(q.replace(/\s/g, "")) || byDoctor(p).length)
    : [];
  const viaDoctor = found.filter((p) => !(p.name.toLowerCase().includes(q) || p.mrn.includes(q)) && byDoctor(p).length);
  return { q, found, viaDoctor, byDoctor };
}

export function Home() {
  const { t } = useTranslation();
  const w = useW();
  const { q: query, tabs, homeSel, homePanel, walkin, set, openPatient } = useUi();
  const { q, found, viaDoctor, byDoctor } = searchPatients(w, query);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <Card.Content>
          <SearchField aria-label={t("home.find")} value={query} onChange={(v) => set({ q: v })} autoFocus fullWidth>
            <div className="mb-1 flex items-center justify-between">
              <Label>{t("home.find")}</Label>
              <ComingSoon when="M4" label={t("home.storyMap")} className="flex items-center gap-1 text-sm text-accent">
                <Info className="size-3.5" /> {t("home.storyMap")}
              </ComingSoon>
            </div>
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder={t("home.placeholder")} />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
        </Card.Content>
      </Card>

      {!q ? (
        <EmptyState title={t("home.blankTitle")}>
          {t("home.blankSub")} {tabs.length > 0 && <T k="home.openTabs" p={{ count: tabs.length }} />}
        </EmptyState>
      ) : (
        <>
          <div className="flex items-baseline gap-3">
            <h1 className="text-lg font-bold text-vida-navy">{t("home.patients")}</h1>
            <span className="text-sm text-muted" data-testid="result-count">
              {viaDoctor.length ? t("home.byDoctor", { count: found.length, doctors: viaDoctor.length }) : found.length}
            </span>
          </div>
          {!found.length && <EmptyState>{t("home.noMatch", { q: query })}</EmptyState>}
          {found.map((p) => {
            const pv = pendingVisits(w, p.mrn);
            const acts = pv.today.filter((x) => x.kind === "act");
            const waits = pv.today.filter((x) => x.kind === "wait");
            const ongoing = pv.today.filter((x) => x.kind === "ongoing");
            const on = homeSel === p.mrn;
            const dv = byDoctor(p);
            const toggle = () => set(on ? { homeSel: null, homePanel: null } : { homeSel: p.mrn, homePanel: null, walkin: null });
            return (
              <Card key={p.mrn} className="gap-0 p-0" data-testid={`patient-${p.mrn}`}>
                <div className="flex items-center gap-3 p-4">
                  <Button variant="ghost" className="h-auto min-w-0 flex-1 justify-start gap-3 px-2 py-1 text-start" aria-expanded={on} onPress={toggle}>
                    {on ? <ChevronDown className="size-4 text-muted" /> : <ChevronRight className="size-4 text-muted rtl:rotate-180" />}
                    <span className="min-w-0">
                      <b className="block text-vida-navy">{p.name}</b>
                      <span className="text-sm font-normal text-muted">{t("patient.idLine", { mrn: p.mrn, age: p.age, gender: p.gender, mobile: p.mobile })}</span>
                    </span>
                  </Button>
                  {dv.length > 0 && (
                    <Chip size="sm" color="accent" variant="soft">{t("home.drs", { names: [...new Set(dv.map((c) => c.doctor))].join(", Dr ") })}</Chip>
                  )}
                  <Button size="sm" variant="ghost" onPress={() => openPatient(p.mrn)}>
                    {t("home.profile")} <ChevronRight className="size-3.5 rtl:rotate-180" />
                  </Button>
                </div>

                {on && (
                  <div className="flex flex-col gap-3 border-t border-border p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <HomeOption
                        icon={<Clock className="size-5" />}
                        title={t("home.todaysPending")}
                        sub={pv.today.length
                          ? [acts.length && t("home.toDo", { count: acts.length }), ongoing.length && t("home.ongoing", { count: ongoing.length }),
                             waits.length && t("home.waiting", { count: waits.length })].filter(Boolean).join(" · ")
                          : t("home.nothingToday")}
                        count={pv.today.length}
                        due={acts.length > 0}
                        selected={homePanel === "pending"}
                        onPress={() => set({ homePanel: homePanel === "pending" ? null : "pending" })}
                      />
                      <HomeOption
                        icon={<UserPlus className="size-5" />}
                        title={t("home.walkinTitle")}
                        sub={t("home.walkinSub")}
                        selected={homePanel === "walkin"}
                        onPress={() => (homePanel === "walkin" ? set({ homePanel: null }) : startWalkin(p.mrn))}
                      />
                    </div>
                    {homePanel === "walkin" && walkin?.at !== "profile" && <WalkinFlow />}
                    {homePanel === "pending" && (
                      <div className="flex flex-col gap-2">
                        {!pv.today.length && (
                          <p className="text-sm text-muted">
                            {t("home.noneToday")} {pv.upcoming.length > 0 && t("home.upcomingOnProfile", { count: pv.upcoming.length })}
                          </p>
                        )}
                        {[...acts, ...ongoing, ...waits].map((x) => <ActionTile key={x.c.id} x={x} compact />)}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
}

function HomeOption(props: {
  icon: React.ReactNode; title: string; sub: string; count?: number; due?: boolean; selected?: boolean; onPress?: () => void;
}) {
  return (
    <Button
      variant={props.selected ? "primary" : "secondary"}
      onPress={props.onPress}
      aria-pressed={props.selected}
      fullWidth
      className="h-auto justify-start gap-3 whitespace-normal p-3 text-start"
    >
      <span className={props.due && !props.selected ? "text-danger" : ""}>{props.icon}</span>
      <span className="flex-1">
        <b className="block">{props.title}</b>
        <span className="text-xs font-normal opacity-80">{props.sub}</span>
      </span>
      {!!props.count && <Chip size="sm" color={props.due ? "danger" : "default"} variant="primary">{props.count}</Chip>}
    </Button>
  );
}
