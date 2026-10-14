import { useEffect } from "react";
import { Breadcrumbs, Toast } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { dirOf } from "./i18n";
import { visitNo } from "./domain/visits";
import { useW } from "./store/hooks";
import { useUi } from "./store/ui";
import { AppHeader } from "./features/shell/AppHeader";
import { PatientTabs } from "./features/shell/PatientTabs";
import { Home } from "./features/home/Home";
import { PatientScreen } from "./features/patient/Patient";
import { EmptyState } from "./ui/EmptyState";

export default function App() {
  const { i18n } = useTranslation();
  const { screen, theme, lang } = useUi();

  /* theme and language live on <html>, so HeroUI and React Aria follow them */
  useEffect(() => {
    const el = document.documentElement;
    el.dataset.theme = theme;
    el.classList.toggle("dark", theme === "dark");
    el.classList.toggle("light", theme === "light");
  }, [theme]);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dirOf(lang);
    void i18n.changeLanguage(lang);
  }, [lang, i18n]);

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-[960px] px-4 pb-20 pt-3 lg:px-5">
        <PatientTabs />
        {screen === "patient" ? <PatientScreen /> : screen === "visit" ? <VisitPlaceholder /> : screen === "invoices" ? <InvoicesPlaceholder /> : <Home />}
      </main>
      <Toast.Provider placement="top end" maxVisibleToasts={3} />
    </>
  );
}

/* The visit screen is checkpoint 1b; the Invoices screen is 1c. */
function VisitPlaceholder() {
  const { t } = useTranslation();
  const w = useW();
  const { caseId, goHome, openPatient } = useUi();
  const c = w.cases.find((x) => x.id === caseId)!;
  const p = w.patients[c.mrn]!;
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs>
        <Breadcrumbs.Item onPress={goHome}>{t("patient.home")}</Breadcrumbs.Item>
        <Breadcrumbs.Item onPress={() => openPatient(p.mrn)}>{p.name}</Breadcrumbs.Item>
        <Breadcrumbs.Item>{c.visitType} · {c.clinic} · {c.date}</Breadcrumbs.Item>
      </Breadcrumbs>
      <EmptyState title={t("visit.placeholderTitle")}>
        {t("visit.placeholderSub", { visit: visitNo(c), type: c.visitType, clinic: c.clinic })}
      </EmptyState>
    </div>
  );
}
function InvoicesPlaceholder() {
  const { t } = useTranslation();
  return <EmptyState title={t("tabs.invoices")}>{t("invoicesScreen.placeholder")}</EmptyState>;
}
