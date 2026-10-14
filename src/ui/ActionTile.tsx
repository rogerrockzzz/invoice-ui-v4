import { Button, Card, Chip } from "@heroui/react";
import { ArrowLeftRight, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { fmt } from "../domain/money";
import { payerOf } from "../domain/lookup";
import { mainStory, stageMsg, storyStage } from "../domain/stories";
import type { PendingItem } from "../domain/steps";
import { isFuture, isToday } from "../domain/visits";
import { useW } from "../store/hooks";
import { useUi } from "../store/ui";
import { M, T } from "./Rich";

const KIND_COLOR = { act: "danger", wait: "warning", ongoing: "accent", done: "success" } as const;

/* v3 actionTile() (line 3269): one pending visit — when, what, where the story is, what it needs */
export function ActionTile({ x, compact }: { x: PendingItem; compact?: boolean }) {
  const { t } = useTranslation();
  const w = useW();
  const openVisit = useUi((s) => s.openVisit);
  const { c, s, kind, owed } = x;
  const main = mainStory(w, c);
  const pos = storyStage(w, c, main);
  const next = stageMsg(main, pos.index);
  const amt = owed > 0 ? owed : s.amt || 0;
  const open = () => openVisit(c.id, c.mrn);

  if (compact)
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm" data-testid={`tile-${c.id}`}>
        <b className="w-12 tabular-nums">{c.arrived}</b>
        <span className="flex-1">
          {c.visitType} · {c.clinic}
          {c.interbranch && <ArrowLeftRight className="ms-1 inline size-3.5 text-vida-purple" aria-label={t("tile.from", { branch: c.fromBranch })} />}
        </span>
        <span className={kind === "act" ? "font-semibold text-danger" : "text-muted"}>
          {kind === "ongoing" ? t("tile.ongoing") : kind === "wait" ? t("tile.waiting") : ""}<M msg={next} />
        </span>
        <span className={`w-24 text-end tabular-nums ${owed > 0 ? "font-semibold text-danger" : ""}`}>{amt ? fmt(amt) : ""}</span>
        <Button size="sm" variant={kind === "act" ? "primary" : "secondary"} onPress={open}>
          {t("tile.open")} <ChevronRight className="size-3.5 rtl:rotate-180" />
        </Button>
      </div>
    );

  /* credit belongs to the patient, not the visit — it is on the header already, not repeated per tile */
  const status = isFuture(c) ? "upcoming" : kind === "done" ? "wait" : kind;
  return (
    <Card
      className={`flex-row items-center gap-4 border-s-4 p-4 ${kind === "act" ? "border-s-danger" : kind === "wait" ? "border-s-warning" : "border-s-accent"}`}
      data-testid={`tile-${c.id}`}
    >
      <div className="w-16 text-center">
        <b className="block text-lg tabular-nums text-vida-navy">{c.slot || c.arrived}</b>
        <span className="text-xs text-muted">{isFuture(c) ? c.date : isToday(c) ? t("tile.today") : c.date}</span>
      </div>
      <div className="min-w-0 flex-1 border-s border-border ps-4">
        <div className="flex flex-wrap items-center gap-2">
          <b className="text-vida-navy">{c.visitType} · {c.clinic}</b>
          {c.interbranch && (
            <Chip size="sm" variant="soft" className="bg-vida-purple-soft text-vida-purple">
              <ArrowLeftRight className="size-3" /> {c.fromBranch}
            </Chip>
          )}
        </div>
        <div className="text-sm text-muted">{t("tile.doctorPayer", { doctor: c.doctor, payer: payerOf(w, c).label })}</div>
        <div className="mt-1 flex items-center gap-3 text-sm">
          <Chip size="sm" color={isFuture(c) ? "default" : KIND_COLOR[kind]} variant="soft">{t(`tile.status.${status}`)}</Chip>
          <span><T k="tile.next" p={{ stage: next }} /></span>
        </div>
      </div>
      <Button variant={kind === "act" ? "primary" : "secondary"} onPress={open}>
        {t("tile.open")} <ChevronRight className="size-4 rtl:rotate-180" />
      </Button>
    </Card>
  );
}
