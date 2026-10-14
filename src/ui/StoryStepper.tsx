import { Check, Minus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { STORIES, type StagePos, type StoryId } from "../domain/stories";

/* v3 stagesBar() (line 2108): a story's fixed stages — done ✓ / now / next / skipped – (HeroUI has no stepper) */
export type StageState = "done" | "now" | "next" | "skip";
export const stageState = (pos: StagePos, i: number): StageState =>
  pos.skipped.includes(i) ? "skip" : pos.complete || i < pos.index ? "done" : i === pos.index && !pos.locked ? "now" : "next";

const DOT: Record<StageState, string> = {
  done: "bg-success text-success-foreground",
  now: "bg-accent text-accent-foreground",
  next: "bg-default text-muted",
  skip: "bg-default text-muted",
};

export function StoryStepper({ id, pos }: { id: StoryId; pos: StagePos }) {
  const { t } = useTranslation();
  const n = STORIES[id].stages;
  return (
    <ol
      aria-label={t("visit.stagesOf", { story: t(`story.${id}.title`) })}
      data-story={id}
      data-locked={pos.locked ? "" : undefined}
      className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${pos.locked ? "opacity-60" : ""}`}
    >
      {Array.from({ length: n }, (_, i) => {
        const st = stageState(pos, i);
        return (
          <li key={i} data-state={st} aria-current={st === "now" ? "step" : undefined} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden className={`h-px w-4 ${st === "done" ? "bg-success" : "bg-border"}`} />}
            <span className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${DOT[st]}`}>
              {st === "done" ? <Check className="size-3.5" aria-label={t("visit.stage.done")} />
                : st === "skip" ? <Minus className="size-3.5" aria-label={t("visit.stage.skip")} /> : i + 1}
            </span>
            <span className={`text-xs ${st === "now" ? "font-semibold text-foreground" : st === "skip" ? "text-muted line-through" : "text-muted"}`}>
              {t(`story.${id}.stages.${i}`)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
