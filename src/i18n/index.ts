import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../locales/en.json";
import ar from "../locales/ar.json";

export type Lang = "en" | "ar";
export const dirOf = (lang: Lang) => (lang === "ar" ? "rtl" : "ltr");
/* each language is named in itself, so the switch reads the same whichever is on */
export const LANG_NAMES: Record<Lang, string> = { en: "English", ar: "العربية" };

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ar: { translation: ar } },
  lng: "en",
  fallbackLng: "en",
  /* React escapes text; amounts are pre-formatted with Western digits (domain/money.ts) */
  interpolation: { escapeValue: false },
  returnObjects: false,
});

export default i18n;
