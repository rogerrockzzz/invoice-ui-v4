import { Button, Chip, CloseButton } from "@heroui/react";
import { House, ReceiptText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { visitsOf } from "../../domain/lookup";
import { pendingSummary } from "../../domain/steps";
import { useW } from "../../store/hooks";
import { useUi } from "../../store/ui";

/* v3 renderTabs() (line 3453): open patients live as tabs, so several can be worked at once.
   Built from Buttons + CloseButton rather than Tabs: a close control may not sit inside a role="tab". */
export function PatientTabs() {
  const { t } = useTranslation();
  const w = useW();
  const { screen, tabs, activeMrn, goHome, openPatient, closeTab, openInvoices } = useUi();

  return (
    <nav aria-label={t("tabs.openPatients")} className="no-print mb-3 flex flex-wrap items-center gap-1.5">
      <Button size="sm" variant={screen === "home" ? "primary" : "secondary"} onPress={goHome}>
        <House className="size-3.5" />
        {t("tabs.home")}
      </Button>
      {tabs.map((mrn) => {
        const p = w.patients[mrn]!;
        const label = `${p.name.split(" ")[0]} ${p.name.split(" ")[1] || ""}`.trim();
        const acts = visitsOf(w, mrn).filter((c) => !c.closed && pendingSummary(w, c).kind === "act").length;
        const on = activeMrn === mrn && screen !== "home" && screen !== "invoices";
        return (
          <div key={mrn} className={`flex items-center rounded-full ${on ? "bg-accent text-accent-foreground" : "bg-default"}`}>
            <Button size="sm" variant={on ? "primary" : "secondary"} aria-current={on ? "page" : undefined} onPress={() => openPatient(mrn)}>
              {label}
              {acts > 0 && <Chip size="sm" color="warning" variant="primary">{acts}</Chip>}
            </Button>
            <CloseButton aria-label={t("tabs.close", { name: label })} className="me-1" onPress={() => closeTab(mrn)} />
          </div>
        );
      })}
      <div className="flex-1" />
      <Button size="sm" variant={screen === "invoices" ? "primary" : "outline"} onPress={openInvoices}>
        <ReceiptText className="size-3.5" />
        {t("tabs.invoices")}
      </Button>
    </nav>
  );
}
