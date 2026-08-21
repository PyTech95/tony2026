import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "./locales/en.json";
import es from "./locales/es.json";

// English-only first pass. The framework + es scaffold are wired so Spanish is a
// drop-in later (add strings to es.json, expose a language toggle, and lift the
// `lng: "en"` lock below to enable detection between en/es).
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
    },
    lng: "en",
    fallbackLng: "en",
    supportedLngs: ["en", "es"],
    // Keys are flat literal strings (e.g. "i18n:memb.plan.essential.name", "nav.home"),
    // so disable namespace/key separators to avoid unintended nesting.
    keySeparator: false,
    nsSeparator: false,
    returnEmptyString: false,
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "ty_lang",
    },
  });

export default i18n;
