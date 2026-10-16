import { useEffect } from "react";
import { Toast } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { dirOf } from "./i18n";
import { useUi } from "./store/ui";
import { AppHeader } from "./features/shell/AppHeader";
import { PatientTabs } from "./features/shell/PatientTabs";
import { Home } from "./features/home/Home";
import { PatientScreen } from "./features/patient/Patient";
import { PkgBookModal } from "./features/patient/PkgBookModal";
import { VisitScreen } from "./features/visit/VisitScreen";
import { EventModal } from "./features/visit/EventModal";
import { LwbsModal } from "./features/visit/LwbsModal";
import { InvoiceModal } from "./features/invoices/InvoiceModal";
import { PaymentDrawer } from "./features/drawer/PaymentDrawer";
import { AdvanceDrawer } from "./features/wallet/AdvanceDrawer";
import { SimulatePanel } from "./features/sim/SimulatePanel";
import { InvoicesScreen } from "./features/invoices/InvoicesScreen";
import { VoidPrintModal } from "./features/stories/VoidPrintModal";

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
        {screen === "patient" ? <PatientScreen /> : screen === "visit" ? <VisitScreen /> : screen === "invoices" ? <InvoicesScreen /> : <Home />}
      </main>
      <PaymentDrawer />
      <AdvanceDrawer />
      <EventModal />
      <InvoiceModal />
      <LwbsModal />
      <PkgBookModal />
      <VoidPrintModal />
      <SimulatePanel />
      <Toast.Provider placement="top end" maxVisibleToasts={3} />
    </>
  );
}
