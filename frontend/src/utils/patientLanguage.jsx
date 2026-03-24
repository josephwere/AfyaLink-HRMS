import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import apiFetch from "./apiFetch";
import { useAuth } from "./auth";
import { useSystemSettings } from "./systemSettings.jsx";
import { PATIENT_LANGUAGE_OPTIONS, PATIENT_TRANSLATIONS } from "./patientTranslations";

const STORAGE_KEY = "afyalink_patient_language";
const PatientLanguageContext = createContext(null);

function normalizeLanguage(value, allowed = []) {
  const code = String(value || "").trim().toLowerCase();
  if (!code) return allowed[0] || "en";
  return allowed.includes(code) ? code : allowed[0] || "en";
}

function interpolate(template, vars = {}) {
  return String(template || "").replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? "");
}

export function PatientLanguageProvider({ children }) {
  const { user, patchUser } = useAuth();
  const { settings } = useSystemSettings();
  const config = settings?.patientSelfService || {};
  const availableLanguages = useMemo(() => {
    const enabled = Array.isArray(config.enabledLanguages) ? config.enabledLanguages : ["en", "sw", "fr"];
    const normalized = [...new Set(enabled.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean))];
    return normalized.length ? normalized : ["en"];
  }, [config.enabledLanguages]);

  const defaultLanguage = normalizeLanguage(config.defaultLanguage || "en", availableLanguages);
  const [language, setLanguageState] = useState(() => {
    const fromStorage = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : "";
    return normalizeLanguage(fromStorage || defaultLanguage, availableLanguages);
  });

  useEffect(() => {
    const next = normalizeLanguage(
      user?.uiPreferences?.patientLanguage ||
        user?.uiPreferences?.locale ||
        localStorage.getItem(STORAGE_KEY) ||
        defaultLanguage,
      availableLanguages
    );
    setLanguageState(next);
  }, [availableLanguages, defaultLanguage, user?.uiPreferences?.locale, user?.uiPreferences?.patientLanguage]);

  const setLanguage = useCallback(
    async (nextLanguage, options = {}) => {
      const normalized = normalizeLanguage(nextLanguage, availableLanguages);
      setLanguageState(normalized);
      try {
        localStorage.setItem(STORAGE_KEY, normalized);
      } catch {
        // ignore storage quota issues
      }

      if (options.persist === false || !user) return normalized;

      const uiPreferences = {
        ...(user.uiPreferences || {}),
        locale: normalized,
        patientLanguage: normalized,
      };

      patchUser?.({ uiPreferences });

      try {
        await apiFetch("/api/profile", {
          method: "PUT",
          body: { uiPreferences },
        });
      } catch {
        // keep the in-memory preference even if the persistence call fails.
      }

      return normalized;
    },
    [availableLanguages, patchUser, user]
  );

  const t = useCallback(
    (key, fallback = "", vars = {}) => {
      const table = PATIENT_TRANSLATIONS[language] || PATIENT_TRANSLATIONS.en || {};
      const english = PATIENT_TRANSLATIONS.en || {};
      const template = table[key] ?? english[key] ?? fallback ?? key;
      return interpolate(template, vars);
    },
    [language]
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      allowLanguageSwitch: config.allowLanguageSwitch !== false,
      availableLanguages,
      options: PATIENT_LANGUAGE_OPTIONS.filter((item) => availableLanguages.includes(item.code)),
      defaultLanguage,
      voiceFirstIntake: config.voiceFirstIntake === true,
      whatsappSupport: config.whatsappSupport === true,
      helpLine: config.helpLine || "",
    }),
    [
      availableLanguages,
      config.allowLanguageSwitch,
      config.helpLine,
      config.voiceFirstIntake,
      config.whatsappSupport,
      defaultLanguage,
      language,
      setLanguage,
      t,
    ]
  );

  return (
    <PatientLanguageContext.Provider value={value}>
      {children}
    </PatientLanguageContext.Provider>
  );
}

export function usePatientLanguage() {
  const ctx = useContext(PatientLanguageContext);
  if (!ctx) {
    throw new Error("usePatientLanguage must be used inside PatientLanguageProvider");
  }
  return ctx;
}
