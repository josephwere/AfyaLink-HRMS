import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import apiFetch from "./apiFetch";
import { useAuth } from "./auth";
import { useSystemSettings } from "./systemSettings.jsx";
import {
  APP_DYNAMIC_TRANSLATORS,
  APP_FRAGMENT_TRANSLATIONS,
  APP_LANGUAGE_OPTIONS,
  APP_TEXT_TRANSLATIONS,
  APP_UI_COPY,
} from "./appTranslations";

const STORAGE_KEY = "afyalink_app_language";
const AppLanguageContext = createContext(null);
const TEXT_NODE_STATE = new WeakMap();
const ATTR_STATE = new WeakMap();
const ATTRIBUTE_NAMES = ["placeholder", "title", "aria-label"];
const INPUT_VALUE_TYPES = new Set(["button", "submit", "reset"]);
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "TEXTAREA"]);

function normalizeLanguage(value, allowed = []) {
  const code = String(value || "").trim().toLowerCase();
  if (!code) return allowed[0] || "en";
  return allowed.includes(code) ? code : allowed[0] || "en";
}

function interpolate(template, vars = {}) {
  return String(template || "").replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? "");
}

function normalizeLookupText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function preserveWhitespace(source, translated) {
  const match = String(source || "").match(/^(\s*)([\s\S]*?)(\s*)$/);
  if (!match) return translated;
  return `${match[1] || ""}${translated}${match[3] || ""}`;
}

function resolveConfig(settings) {
  const localization = settings?.localization || settings?.patientSelfService || {};
  const enabled = Array.isArray(localization.enabledLanguages)
    ? localization.enabledLanguages
    : ["en", "sw", "fr"];
  const enabledLanguages = [...new Set(enabled.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean))];
  return {
    enabledLanguages: enabledLanguages.length ? enabledLanguages : ["en"],
    defaultLanguage: String(localization.defaultLanguage || "en").trim().toLowerCase() || "en",
    allowLanguageSwitch: localization.allowLanguageSwitch !== false,
  };
}

function translateExact(text, language) {
  if (!text || language === "en") return text;
  const key = normalizeLookupText(text);
  if (!key) return text;
  const table = APP_TEXT_TRANSLATIONS[language] || {};
  const translated = table[key];
  return translated ? preserveWhitespace(text, translated) : text;
}

function translateDynamic(text, language) {
  if (!text || language === "en") return text;
  const normalized = normalizeLookupText(text);
  if (!normalized) return text;
  const workspaceMatch = normalized.match(/^([A-Z_ ]+)\s+Workspace$/);
  if (workspaceMatch) {
    const translatedRole = translateExact(workspaceMatch[1], language);
    const translatedWorkspace = translateExact("Workspace", language);
    return preserveWhitespace(text, `${translatedRole} ${translatedWorkspace}`.trim());
  }
  const loginAttemptMatch = normalized.match(/^Last login attempt:\s+(.+)$/);
  if (loginAttemptMatch) {
    const prefix = language === "sw" ? "Jaribio la mwisho la kuingia:" : "Derniere tentative de connexion :";
    return preserveWhitespace(text, `${prefix} ${loginAttemptMatch[1]}`);
  }
  const patterns = APP_DYNAMIC_TRANSLATORS[language] || [];
  for (const entry of patterns) {
    const match = normalized.match(entry.pattern);
    if (match) {
      return preserveWhitespace(text, entry.translate(match));
    }
  }
  return text;
}

function looksLikeUiLabel(text) {
  const normalized = normalizeLookupText(text);
  if (!normalized || normalized.length > 80) return false;
  if (/[.@/]/.test(normalized)) return false;
  return /^[A-Z0-9][A-Za-z0-9&%/+\-(): ]+$/.test(normalized);
}

function translateByFragments(text, language) {
  if (!text || language === "en" || !looksLikeUiLabel(text)) return text;
  const fragments = APP_FRAGMENT_TRANSLATIONS[language] || {};
  const entries = Object.entries(fragments).sort((a, b) => b[0].length - a[0].length);
  if (!entries.length) return text;

  let translated = String(text);
  let changed = false;

  for (const [source, target] of entries) {
    const pattern = new RegExp(`\\b${source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
    const next = translated.replace(pattern, target);
    if (next !== translated) {
      translated = next;
      changed = true;
    }
  }

  return changed ? preserveWhitespace(text, translated) : text;
}

export function translateAppText(text, language) {
  const exact = translateExact(text, language);
  if (exact !== text) return exact;
  const dynamic = translateDynamic(text, language);
  if (dynamic !== text) return dynamic;
  return translateByFragments(text, language);
}

function processTextNode(node, language) {
  const current = node.textContent || "";
  if (!normalizeLookupText(current)) return;
  const parent = node.parentElement;
  if (!parent) return;
  if (parent.closest("[data-i18n-ignore='true']")) return;
  if (SKIP_TAGS.has(parent.tagName)) return;

  const state = TEXT_NODE_STATE.get(node) || { original: current, translated: current };
  if (current !== state.original && current !== state.translated) {
    state.original = current;
  }

  const next = language === "en" ? state.original : translateAppText(state.original, language);
  state.translated = next;
  TEXT_NODE_STATE.set(node, state);

  if (current !== next) {
    node.textContent = next;
  }
}

function processElementAttributes(element, language) {
  if (!(element instanceof HTMLElement)) return;
  if (element.closest("[data-i18n-ignore='true']")) return;
  if (SKIP_TAGS.has(element.tagName)) return;

  const attrState = ATTR_STATE.get(element) || {};
  ATTRIBUTE_NAMES.forEach((attr) => {
    if (!element.hasAttribute(attr)) return;
    const current = element.getAttribute(attr) || "";
    if (!normalizeLookupText(current)) return;
    const state = attrState[attr] || { original: current, translated: current };
    if (current !== state.original && current !== state.translated) {
      state.original = current;
    }
    const next = language === "en" ? state.original : translateAppText(state.original, language);
    state.translated = next;
    attrState[attr] = state;
    if (current !== next) {
      element.setAttribute(attr, next);
    }
  });

  if (element instanceof HTMLInputElement && INPUT_VALUE_TYPES.has(String(element.type || "").toLowerCase())) {
    const current = element.value || "";
    if (normalizeLookupText(current)) {
      const state = attrState.value || { original: current, translated: current };
      if (current !== state.original && current !== state.translated) {
        state.original = current;
      }
      const next = language === "en" ? state.original : translateAppText(state.original, language);
      state.translated = next;
      attrState.value = state;
      if (current !== next) {
        element.value = next;
      }
    }
  }

  ATTR_STATE.set(element, attrState);
}

function translateDomTree(root, language) {
  if (typeof document === "undefined" || !root) return;
  const textWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  let node = textWalker.nextNode();
  while (node) {
    processTextNode(node, language);
    node = textWalker.nextNode();
  }

  if (root instanceof HTMLElement) {
    processElementAttributes(root, language);
  }
  const elements = typeof root.querySelectorAll === "function"
    ? root.querySelectorAll("[placeholder],[title],[aria-label],input[type='button'],input[type='submit'],input[type='reset']")
    : [];
  elements.forEach((element) => {
    processElementAttributes(element, language);
  });
}

export function AppLanguageProvider({ children }) {
  const { user, patchUser } = useAuth();
  const { settings } = useSystemSettings();
  const location = useLocation();
  const config = useMemo(() => resolveConfig(settings), [settings]);
  const availableLanguages = config.enabledLanguages;
  const defaultLanguage = normalizeLanguage(config.defaultLanguage || "en", availableLanguages);
  const [language, setLanguageState] = useState(() => {
    const fromStorage = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : "";
    return normalizeLanguage(fromStorage || defaultLanguage, availableLanguages);
  });
  const observerRef = useRef(null);
  const frameRef = useRef(0);
  const titleStateRef = useRef({ original: typeof document !== "undefined" ? document.title : "" });

  useEffect(() => {
    const next = normalizeLanguage(
      user?.uiPreferences?.appLanguage ||
        user?.uiPreferences?.locale ||
        user?.uiPreferences?.patientLanguage ||
        (typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : "") ||
        defaultLanguage,
      availableLanguages
    );
    setLanguageState(next);
  }, [availableLanguages, defaultLanguage, user?.uiPreferences?.appLanguage, user?.uiPreferences?.locale, user?.uiPreferences?.patientLanguage]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = language || "en";
  }, [language]);

  const setLanguage = useCallback(
    async (nextLanguage, options = {}) => {
      const normalized = normalizeLanguage(nextLanguage, availableLanguages);
      setLanguageState(normalized);
      try {
        localStorage.setItem(STORAGE_KEY, normalized);
      } catch {
        // ignore storage errors
      }

      if (options.persist === false || !user) return normalized;

      const uiPreferences = {
        ...(user.uiPreferences || {}),
        locale: normalized,
        appLanguage: normalized,
        patientLanguage: normalized,
      };

      patchUser?.({ uiPreferences });

      try {
        await apiFetch("/api/profile", {
          method: "PUT",
          body: { uiPreferences },
        });
      } catch {
        // keep the local preference even if persistence fails
      }

      return normalized;
    },
    [availableLanguages, patchUser, user]
  );

  const t = useCallback(
    (key, fallback = "", vars = {}) => {
      const table = APP_UI_COPY[language] || APP_UI_COPY.en || {};
      const english = APP_UI_COPY.en || {};
      const template = table[key] ?? english[key] ?? fallback ?? key;
      return interpolate(template, vars);
    },
    [language]
  );

  const translateText = useCallback(
    (text, fallback = "") => {
      const source = typeof text === "string" && text.length ? text : fallback;
      return translateAppText(source, language);
    },
    [language]
  );

  const translateCollection = useCallback(
    (items = [], keys = ["label", "title", "subtitle", "section"]) =>
      (items || []).map((item) => {
        if (!item || typeof item !== "object") return item;
        const next = { ...item };
        keys.forEach((key) => {
          if (typeof next[key] === "string") {
            next[key] = translateText(next[key]);
          }
        });
        return next;
      }),
    [translateText]
  );

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const scheduleTranslate = () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => {
        translateDomTree(document.body, language);
        const currentTitle = document.title || "";
        const titleState = titleStateRef.current;
        if (currentTitle !== titleState.original && currentTitle !== titleState.translated) {
          titleState.original = currentTitle;
        }
        const nextTitle = language === "en" ? titleState.original : translateAppText(titleState.original, language);
        titleState.translated = nextTitle;
        if (document.title !== nextTitle) {
          document.title = nextTitle;
        }
      });
    };

    scheduleTranslate();

    const observer = new MutationObserver(() => scheduleTranslate());
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
    });
    observerRef.current = observer;

    return () => {
      observer.disconnect();
      observerRef.current = null;
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [language, location.pathname]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      translateText,
      translateCollection,
      allowLanguageSwitch: config.allowLanguageSwitch !== false,
      availableLanguages,
      options: APP_LANGUAGE_OPTIONS.filter((item) => availableLanguages.includes(item.code)),
      defaultLanguage,
    }),
    [availableLanguages, config.allowLanguageSwitch, defaultLanguage, language, setLanguage, t, translateCollection, translateText]
  );

  return <AppLanguageContext.Provider value={value}>{children}</AppLanguageContext.Provider>;
}

export function useAppLanguage() {
  const ctx = useContext(AppLanguageContext);
  if (!ctx) {
    throw new Error("useAppLanguage must be used inside AppLanguageProvider");
  }
  return ctx;
}
