import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ar from "./locales/ar.json";
import en from "./locales/en.json";

export type Lang = "ar" | "en";

const saved = (() => {
  try {
    return localStorage.getItem("lang") as Lang | null;
  } catch {
    return null;
  }
})();

i18n.use(initReactI18next).init({
  resources: { ar: { translation: ar }, en: { translation: en } },
  lng: saved ?? "ar",
  fallbackLng: "ar",
  interpolation: { escapeValue: false },
});

/** Switches text and direction together, without remounting anything. */
export function applyLang(lang: Lang) {
  i18n.changeLanguage(lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  try {
    localStorage.setItem("lang", lang);
  } catch {
    /* per-PC preference only */
  }
}

applyLang((i18n.language as Lang) ?? "ar");

export default i18n;
