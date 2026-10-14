import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { Check, Info, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { liveInvoices } from "../../domain/lines";
import { planOf } from "../../domain/lookup";
import { invoiceReplace } from "../../domain/replace";
import { activeStory, mainStory, storyBadge, storyLock, visitStories, type StoryId } from "../../domain/stories";
import type { StoryUiCtx, Visit } from "../../domain/types";
import { switchStory } from "../../store/actions";
import { useW } from "../../store/hooks";
import { useWorld } from "../../store/world";
import { ComingSoon } from "../../ui/ComingSoon";
import { M } from "../../ui/Rich";
import { StoryIcon } from "../../ui/StoryIcon";

/* v3 renderStoryStrip() (line 2122): the stories this visit needs right now; one is worked on at a time */
export function StoryStrip({ c, ui }: { c: Visit; ui: StoryUiCtx }) {
  const { t } = useTranslation();
  const w = useW();
  const act = useWorld((s) => s.act);
  const list = visitStories(w, c), on = activeStory(w, c), main = mainStory(w, c);
  const pick = (id: StoryId) => act(c.id, (dw, dc, fx) => switchStory(dw, dc, id, activeStory(dw, dc), fx));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ToggleButtonGroup
        aria-label={t("visit.stories")}
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[on]}
        onSelectionChange={(keys) => { const id = [...keys][0]; if (id && id !== on) pick(id as StoryId); }}
        className="flex flex-wrap justify-start gap-2"
      >
        {list.map((id) => {
          const lock = storyLock(c, id), done = (c.storyDone || {})[id];
          /* only a story the system has just opened is flagged — never the visit's own, never a locked one */
          const fresh = (!["visit", "pkgvisit", "addorders"].includes(id) && !lock && id !== main && !(c.seen || {})[id] && id !== on)
            || (id === "replace" && id !== on && liveInvoices(c).some((i) => { const r = invoiceReplace(w, c, i); return !!r && r.ok && !!planOf(w, c); }));
          return (
            <ToggleButton
              key={id}
              id={id}
              data-story={id}
              data-locked={lock ? "" : undefined}
              aria-description={lock ? t(lock.k) : undefined}
              className={`relative h-auto min-h-11 items-center justify-start gap-2 rounded-xl px-3 py-1.5 text-start ${lock ? "opacity-60" : ""}`}
            >
              <StoryIcon id={id} className="size-4 shrink-0" />
              <span className="leading-tight">
                <b className="flex items-center gap-1 text-sm">
                  {t(`story.${id}.title`)}{done && id !== on && <Check className="size-3.5 text-success" aria-label={t("visit.stage.done")} />}
                </b>
                <span className="flex items-center gap-1 text-[11px] font-normal text-muted">
                  {lock ? <><Lock className="size-3" />{t(lock.k)}</> : done ? done.title : <M msg={storyBadge(w, c, id, ui)} />}
                </span>
              </span>
              {fresh && <span className="absolute -top-1 end-1 size-2.5 rounded-full bg-danger" role="img" aria-label={t("visit.new")} />}
            </ToggleButton>
          );
        })}
      </ToggleButtonGroup>
      <ComingSoon when="M4" label={t("home.storyMap")} className="ms-auto inline-flex items-center gap-1 text-xs text-muted">
        <Info className="size-3.5" /> {t("home.storyMap")}
      </ComingSoon>
    </div>
  );
}
