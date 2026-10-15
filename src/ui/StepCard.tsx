import { Button, Card, Chip } from "@heroui/react";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { due } from "../domain/lines";
import { fmt } from "../domain/money";
import type { ActionVariant, NextStep, StepAction } from "../domain/steps";
import type { Visit } from "../domain/types";
import { resolveMsg } from "../i18n/msg";
import { STEP_LATER, STEP_RUN } from "../store/stepActions";
import { useUi } from "../store/ui";
import { useWorld } from "../store/world";
import { ComingSoon } from "./ComingSoon";
import { invLink } from "./InvoiceLink";
import { OrderTable } from "./OrderTable";
import { M } from "./Rich";

/* v3 button classes → HeroUI variants. "yes" is the green go-ahead; HeroUI's Button has no success
   variant, so the primary variant is tinted with the theme's --success. */
const VARIANT: Record<ActionVariant, { variant: "primary" | "secondary" | "outline" | "ghost" | "danger"; className?: string }> = {
  yes: { variant: "primary", className: "bg-success text-success-foreground" },
  primary: { variant: "primary" },
  no: { variant: "outline" },
  default: { variant: "outline" },
  danger: { variant: "danger" },
  ghost: { variant: "ghost" },
};
const TONE = { "": "border-s-accent", wait: "border-s-warning", done: "border-s-success" } as const;
const TAG = { "": "accent", wait: "warning", done: "success" } as const;

/* the card every step-driven story shows (v3 renderStep, line 3795) */
export function StepCard({ c, s, top }: { c: Visit; s: NextStep; top?: ReactNode }) {
  const { t } = useTranslation();
  const act = useWorld((x) => x.act);
  const openDrawer = useUi((x) => x.openDrawer);
  const run = (id: StepAction["id"]) => {
    if (id === "openDrawer") return openDrawer(c.id, c.mrn, due(c));
    const fn = STEP_RUN[id];
    if (fn) act(c.id, fn);
  };
  return (
    <Card className={`gap-3 border-s-4 p-5 ${TONE[s.tone]}`} data-testid="step-card" data-step={s.key}>
      {top}
      <div className="flex items-center gap-2">
        <Chip size="sm" variant="soft" color={TAG[s.tone]}><M msg={s.tag} /></Chip>
        {s.back && (
          <Button size="sm" variant="ghost" className="ms-auto" onPress={() => run(s.back!)}>
            <ChevronLeft className="size-4 rtl:rotate-180" /> {t("step.back")}
          </Button>
        )}
      </div>
      <h2 className="text-lg font-bold text-vida-navy" data-testid="step-q"><M msg={s.q} renderInvoice={invLink} /></h2>
      <p className="text-sm text-muted" data-testid="step-sub"><M msg={s.sub} renderInvoice={invLink} /></p>
      {s.amt != null && (
        <div className="flex items-baseline gap-2" data-testid="step-amt">
          <span className={`text-2xl font-bold tabular-nums ${s.amt > 0 ? "text-danger" : "text-foreground"}`}>{fmt(s.amt)}</span>
          <small className="text-xs text-muted"><M msg={s.amtLabel} /></small>
        </div>
      )}
      {s.amts && (
        <div className="flex flex-wrap gap-6" data-testid="step-amts">
          {s.amts.map((a, i) => (
            <div key={i} className="flex items-baseline gap-2">
              <span className={`text-xl font-bold tabular-nums ${a.tone === "soft" ? "text-muted" : "text-danger"}`}>{fmt(a.v)}</span>
              <small className="text-xs text-muted"><M msg={a.label} /></small>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2" data-testid="step-actions">
        {s.actions.map((a) => {
          const later = STEP_LATER[a.id];
          const label = resolveMsg(t, a.label);
          if (later)
            return (
              <ComingSoon key={a.id} when={later} label={label}
                className="inline-flex h-10 items-center rounded-full border border-border px-4 text-sm font-medium">
                {label}
              </ComingSoon>
            );
          const v = VARIANT[a.variant];
          return <Button key={a.id} variant={v.variant} className={v.className} onPress={() => run(a.id)}>{label}</Button>;
        })}
      </div>
      {s.ext && <OrderTable c={c} ext={s.ext} />}
    </Card>
  );
}
