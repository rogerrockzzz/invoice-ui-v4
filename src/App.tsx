import { useEffect } from "react";
import { Toast } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { dirOf } from "./i18n";
import { useUi } from "./store/ui";
import { AppHeader } from "./features/shell/AppHeader";
import { PatientTabs } from "./features/shell/PatientTabs";
import { Home } from "./features/home/Home";
import { PatientScreen } from "./features/patient/Patient";
import { VisitScreen } from "./features/visit/VisitScreen";
import { EventModal } from "./features/visit/EventModal";
import { InvoiceModal } from "./features/invoices/InvoiceModal";
import { PaymentDrawer } from "./features/drawer/PaymentDrawer";
import { SimulatePanel } from "./features/sim/SimulatePanel";
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
        {screen === "patient" ? <PatientScreen /> : screen === "visit" ? <VisitScreen /> : screen === "invoices" ? <InvoicesPlaceholder /> : <Home />}
      </main>
      <PaymentDrawer />
      <EventModal />
      <InvoiceModal />
      <SimulatePanel />
      <Toast.Provider placement="top end" maxVisibleToasts={3} />
    </>
  );
}

/* The Invoices screen is checkpoint 1c. */
function InvoicesPlaceholder() {
  const { t } = useTranslation();
  return <EmptyState title={t("tabs.invoices")}>{t("invoicesScreen.placeholder")}</EmptyState>;
}
