import { useCallback, useMemo } from "react";
import { useAppLanguage } from "./appLanguage.jsx";
import { PATIENT_LANGUAGE_OPTIONS, PATIENT_TRANSLATIONS } from "./patientTranslations";

function interpolate(template, vars = {}) {
  return String(template || "").replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? "");
}

export function PatientLanguageProvider({ children }) {
  return children;
}

export function usePatientLanguage() {
  const base = useAppLanguage();

  const t = useCallback(
    (key, fallback = "", vars = {}) => {
      const table = PATIENT_TRANSLATIONS[base.language] || PATIENT_TRANSLATIONS.en || {};
      const english = PATIENT_TRANSLATIONS.en || {};
      const template = table[key] ?? english[key] ?? fallback ?? key;
      return interpolate(template, vars);
    },
    [base.language]
  );

  return useMemo(
    () => ({
      ...base,
      t,
      options: PATIENT_LANGUAGE_OPTIONS.filter((item) => base.availableLanguages.includes(item.code)),
    }),
    [base, t]
  );
}
