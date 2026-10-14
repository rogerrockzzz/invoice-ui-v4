import { Button, Card } from "@heroui/react";
import { Clock, Play, RotateCcw, ShieldCheck, Smartphone, Stethoscope } from "lucide-react";
import { useTranslation } from "react-i18next";
import { firstName } from "../../domain/lookup";
import { visitNo } from "../../domain/visits";
import type { Visit, World } from "../../domain/types";
import * as A from "../../store/actions";
import { useW } from "../../store/hooks";
import { useUi } from "../../store/ui";
import { useWorld } from "../../store/world";

/* v3 renderSim() (line 5893): the outside world, on demand — always visible, it is a prototype.
   It acts on the open visit, or on the first visit when none is open (as v3 does), and says which. */
const EVENTS: { id: string; icon: typeof Play; run: (w: World, c: Visit, fx: A.Fx) => void }[] = [
  { id: "approveConsult", icon: ShieldCheck, run: A.simApproveConsult },
  { id: "orders", icon: Stethoscope, run: A.simOrders },
  { id: "approval", icon: ShieldCheck, run: A.simApproval },
  { id: "paid", icon: Smartphone, run: A.simPaid },
  { id: "stale", icon: Clock, run: A.simStale },
];

export function SimulatePanel() {
  const { t } = useTranslation();
  const w = useW();
  const { simOpen, caseId, screen, set } = useUi();
  const act = useWorld((s) => s.act);
  const c = (screen === "visit" && w.cases.find((x) => x.id === caseId)) || w.cases[0]!;
  const reset = () => { useWorld.getState().reset(); useUi.getState().reset(); };

  return (
    <div className="no-print fixed bottom-4 start-4 z-40 flex flex-col items-start gap-2">
      {simOpen && (
        <Card className="w-72 gap-1 p-3 shadow-lg" role="region" aria-label={t("sim.title", { name: firstName(w, c) })} data-testid="sim-panel">
          <h2 className="text-sm font-bold text-vida-navy">{t("sim.title", { name: firstName(w, c) })}</h2>
          <p className="mb-1 text-xs text-muted">{t("sim.target", { visit: visitNo(c), type: c.visitType, clinic: c.clinic })}</p>
          {EVENTS.map((e) => (
            <Button key={e.id} variant="ghost" className="justify-start" onPress={() => act(c.id, e.run)}>
              <e.icon className="size-4" /> {t(`sim.${e.id}`)}
            </Button>
          ))}
          <Button variant="ghost" className="justify-start" onPress={reset}><RotateCcw className="size-4" /> {t("sim.reset")}</Button>
          <Button variant="secondary" className="mt-1" onPress={() => set({ simOpen: false })}>{t("sim.hide")}</Button>
        </Card>
      )}
      {!simOpen && (
        <Button variant="primary" className="bg-vida-navy text-background shadow-lg" onPress={() => set({ simOpen: true })}>
          <Play className="size-4" /> {t("sim.open")}
        </Button>
      )}
    </div>
  );
}
