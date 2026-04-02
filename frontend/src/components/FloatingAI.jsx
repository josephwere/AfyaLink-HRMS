import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { useSystemSettings } from "../utils/systemSettings.jsx";
import { useAuth } from "../utils/auth";
import {
  getAssistantAdvice,
  getAssistantContext,
  chatAssistant,
  summarizeAssistantPage,
  updateAssistantProfile,
  clearAssistantMemory,
  logAssistantAutofillAudit,
} from "../services/assistantApi";
import { extractDocument } from "../services/aiExtractionApi";
import {
  appendTextToFocusedField,
  applyAiActions,
  applyAiAssignments,
  clearFocusedField,
  collectPageActionTargets,
  collectPageFormFields,
  focusNextField,
  focusNextSection,
  focusPreviousField,
  getFocusedFieldContext,
  resolveAiActions,
  serializePageActionTargets,
  resolveAiAssignments,
  serializePageFormFields,
  submitFocusedForm,
} from "../utils/aiFormFill";
import { resolveAutofillTemplate } from "../utils/aiAutofillTemplates";
import { adaptPageFormFields, resolvePageFormAdapter } from "../utils/aiFormAdapters";
import {
  getAssistantStarterPack,
  listAssistantStarterPacks,
  mergeAssistantStarterPack,
} from "../utils/aiStarterMacros";
import { DEFAULT_AI_ICON } from "../constants/aiBranding";

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseNumber(value) {
  if (value === "" || value === null || value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseKeyValueLines(value, separator = "=>") {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const index = line.indexOf(separator);
      if (index < 0) return null;
      return {
        left: line.slice(0, index).trim(),
        right: line.slice(index + separator.length).trim(),
      };
    })
    .filter((entry) => entry?.left && entry?.right);
}

function formatKeyValueLines(rows, leftKey, rightKey, separator = " => ") {
  if (!Array.isArray(rows)) return "";
  return rows
    .map((row) => {
      const left = String(row?.[leftKey] || "").trim();
      const right = String(row?.[rightKey] || "").trim();
      return left && right ? `${left}${separator}${right}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

function normalizeVoiceText(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeVoiceCommand(value) {
  return normalizeVoiceText(value)
    .toLowerCase()
    .replace(/[.!?,]/g, "");
}

export default function FloatingAI() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();
  const { settings } = useSystemSettings();
  const ai = settings?.ai;

  const [open, setOpen] = useState(false);
  const [context, setContext] = useState(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [adviceBusy, setAdviceBusy] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [advice, setAdvice] = useState(null);
  const [symptoms, setSymptoms] = useState("");
  const [temperatureC, setTemperatureC] = useState("");
  const [spo2, setSpo2] = useState("");
  const [conditionsInput, setConditionsInput] = useState("");
  const [medicationsInput, setMedicationsInput] = useState("");
  const [notes, setNotes] = useState("");
  const [dictionaryInput, setDictionaryInput] = useState("");
  const [dotPhrasesInput, setDotPhrasesInput] = useState("");
  const [workflowTemplateInput, setWorkflowTemplateInput] = useState("");
  const [chatPrompt, setChatPrompt] = useState("");
  const [chatAnswer, setChatAnswer] = useState("");
  const [heightCm, setHeightCm] = useState("170");
  const [weightKg, setWeightKg] = useState("70");
  const [dictationField, setDictationField] = useState("");
  const [isDictating, setIsDictating] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(false);
  const [history, setHistory] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatExpanded, setChatExpanded] = useState(true);
  const [launcherIconSrc, setLauncherIconSrc] = useState(() => ai?.icon || DEFAULT_AI_ICON);
  const [launcherIconBroken, setLauncherIconBroken] = useState(false);
  const [formFillPrompt, setFormFillPrompt] = useState("");
  const [formFillBusy, setFormFillBusy] = useState(false);
  const [extractBusy, setExtractBusy] = useState(false);
  const [formFillSource, setFormFillSource] = useState("");
  const [formFillFileName, setFormFillFileName] = useState("");
  const [formFillPastedText, setFormFillPastedText] = useState("");
  const [formFillReport, setFormFillReport] = useState(null);
  const [pageFieldCount, setPageFieldCount] = useState(0);
  const [pageActionCount, setPageActionCount] = useState(0);
  const [pageFieldPreview, setPageFieldPreview] = useState([]);
  const [activeTemplate, setActiveTemplate] = useState(null);
  const [activeAdapter, setActiveAdapter] = useState(null);
  const [formFillDraft, setFormFillDraft] = useState(null);
  const [draftSelection, setDraftSelection] = useState({});
  const [applyBusy, setApplyBusy] = useState(false);
  const [reviewItemId, setReviewItemId] = useState("");
  const [focusedFieldContext, setFocusedFieldContext] = useState(null);
  const [autoApplyHighConfidence, setAutoApplyHighConfidence] = useState(false);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.88);

  const recognitionRef = useRef(null);
  const chatInputRef = useRef(null);
  const chatSectionRef = useRef(null);
  const floatButtonRef = useRef(null);
  const panelRef = useRef(null);
  const uploadInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const aiName = ai?.name || "NeuroEdge";
  const preferredLauncherIcon = ai?.icon || DEFAULT_AI_ICON;
  const greeting = ai?.greeting || "Assistant";
  const assistantProfile = context?.assistantProfile || {};
  const hospitalScope = context?.hospitalScope || String(user?.hospitalId || user?.hospital || "GLOBAL");
  const starterPacks = useMemo(() => listAssistantStarterPacks(), []);

  const isAuthenticated = Boolean(user);
  const role = String(user?.role || "GUEST").toUpperCase();
  const isPatient = role === "PATIENT";
  const isGuest = role === "GUEST";
  const aiAccess = settings?.monetization?.featureAccess?.ai || "FREE";
  const aiEnabled = ai?.enabled !== false;
  const adminRoles = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"];
  const canUseAI = aiEnabled && (aiAccess !== "PREMIUM" || isPatient || isGuest || adminRoles.includes(role));
  const aiLocked = !canUseAI || !isAuthenticated;
  const hasIcon = Boolean(launcherIconSrc) && !launcherIconBroken;
  const launcherLabel = open ? `Hide ${aiName}` : `${aiName} ${greeting}`;
  const launcherInitials = String(aiName || "AI")
    .split(/\s+/)
    .map((part) => part?.[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase() || "AI";
  // Open only when user clicks the floating button.

  const recommendedStarterPackIds = useMemo(() => {
    const roleMap = {
      DOCTOR: ["doctor", "referrals"],
      SURGEON: ["doctor", "referrals"],
      NURSE: ["nurse", "referrals"],
      LAB_TECH: ["lab"],
      RADIOLOGIST: ["lab"],
      HOSPITAL_ADMIN: ["claims", "referrals"],
      SYSTEM_ADMIN: ["claims"],
      SUPER_ADMIN: ["claims"],
      COMMUNITY_HEALTH_WORKER: ["referrals"],
    };
    return roleMap[role] || [];
  }, [role]);

  useEffect(() => {
    setLauncherIconSrc(preferredLauncherIcon);
    setLauncherIconBroken(false);
  }, [preferredLauncherIcon]);

  const handleLauncherIconError = () => {
    // If a custom icon breaks, automatically fall back to the shipped NeuroEdge logo
    // instead of showing a monogram (the "N" users keep seeing).
    if (launcherIconSrc && launcherIconSrc !== DEFAULT_AI_ICON) {
      setLauncherIconSrc(DEFAULT_AI_ICON);
      setLauncherIconBroken(false);
      return;
    }
    setLauncherIconBroken(true);
  };

  useEffect(() => {
    if (!open) return;
    setLoadingContext(true);
    setMsg("");
    if (!isAuthenticated) {
      setLoadingContext(false);
      setMsg("Sign in to use the assistant.");
      return;
    }
    getAssistantContext()
      .then((res) => {
        const ctx = res?.context || {};
        setContext(ctx);
        const profile = ctx.assistantProfile || {};
        setConditionsInput((profile.conditions || []).join(", "));
        setMedicationsInput(
          (profile.medications || [])
            .map((m) => [m.name, m.dosage, m.schedule].filter(Boolean).join(" | "))
            .join(", ")
        );
        setNotes(profile.notes || "");
        setDictionaryInput(formatKeyValueLines(profile.dictionaryTerms || [], "term", "replacement"));
        setDotPhrasesInput(formatKeyValueLines(profile.dotPhrases || [], "shortcut", "content"));
        setWorkflowTemplateInput(
          formatKeyValueLines(profile.workflowTemplates || [], "workflow", "instructions", ": ")
        );
        setAutoApplyHighConfidence(Boolean(profile.autofillPreferences?.autoApplyHighConfidence));
        setConfidenceThreshold(Number(profile.autofillPreferences?.confidenceThreshold || 0.88));
        const memory = Array.isArray(ctx.chatHistory) ? ctx.chatHistory : [];
        setChatMessages(
          memory
            .filter((entry) => entry?.text)
            .map((entry) => ({
              id: entry.id || `${entry.role || "assistant"}-${entry.createdAt || Date.now()}`,
              role: entry.role === "user" ? "user" : "assistant",
              text: entry.text,
              createdAt: entry.createdAt || new Date().toISOString(),
            }))
        );
      })
      .catch((err) => setMsg(err?.message || "Failed to load assistant context"))
      .finally(() => setLoadingContext(false));
  }, [open, isAuthenticated]);

  const getPageAutofillSurface = useCallback(() => {
    const rawFields = collectPageFormFields();
    const fields = adaptPageFormFields({
      pathname: location.pathname,
      fields: rawFields,
      pageTitle: document.title || "AfyaLink",
    });
    const actions = collectPageActionTargets();
    return { fields, actions };
  }, [location.pathname]);

  const refreshPageFields = () => {
    const { fields, actions } = getPageAutofillSurface();
    setPageFieldCount(fields.length);
    setPageActionCount(actions.length);
    setPageFieldPreview(
      fields
        .map((field) => field.label || field.name || field.id || field.key)
        .filter(Boolean)
        .slice(0, 6)
    );
    setActiveTemplate(resolveAutofillTemplate({ pathname: location.pathname, fields, pageTitle: document.title || "AfyaLink" }));
    setActiveAdapter(resolvePageFormAdapter({ pathname: location.pathname, fields, pageTitle: document.title || "AfyaLink" }));
    return { fields, actions };
  };

  useEffect(() => {
    if (!open) return;
    setFormFillReport(null);
    setFormFillDraft(null);
    setDraftSelection({});
    setReviewItemId("");
    refreshPageFields();
    const timer = window.setTimeout(() => refreshPageFields(), 350);
    return () => window.clearTimeout(timer);
  }, [open, location.pathname]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;
    const syncFocusedField = () => setFocusedFieldContext(getFocusedFieldContext());
    syncFocusedField();
    document.addEventListener("focusin", syncFocusedField);
    document.addEventListener("click", syncFocusedField, true);
    return () => {
      document.removeEventListener("focusin", syncFocusedField);
      document.removeEventListener("click", syncFocusedField, true);
    };
  }, [open, location.pathname]);

  const reminderText = useMemo(() => {
    const appt = context?.nextAppointment?.scheduledAt;
    if (!appt) return "No upcoming appointment.";
    return `Next appointment: ${new Date(appt).toLocaleString()}`;
  }, [context]);

  const bmi = useMemo(() => {
    const h = parseNumber(heightCm);
    const w = parseNumber(weightKg);
    if (!h || !w || h <= 0 || w <= 0) return null;
    const meters = h / 100;
    if (!meters) return null;
    const value = w / (meters * meters);
    if (!Number.isFinite(value)) return null;
    return Number(value.toFixed(1));
  }, [heightCm, weightKg]);

  const hydrationHint = useMemo(() => {
    const w = parseNumber(weightKg);
    if (!w || w <= 0) return "Add weight to estimate daily water target.";
    const liters = Math.max(1.5, Math.min(4.5, (w * 0.033))).toFixed(1);
    return `Suggested water target: ~${liters} L/day`;
  }, [weightKg]);

  const hydrationLiters = useMemo(() => {
    const w = parseNumber(weightKg);
    if (!w || w <= 0) return null;
    return Number(Math.max(1.5, Math.min(4.5, w * 0.033)).toFixed(1));
  }, [weightKg]);

  const bmiStatus = useMemo(() => {
    if (!bmi) return { label: "—", tone: "neutral", percent: 0, tip: "BMI will appear after height and weight are filled." };
    if (bmi < 18.5) return { label: "Low", tone: "caution", percent: 35, tip: "BMI is below the normal range." };
    if (bmi <= 24.9) return { label: "Normal", tone: "ok", percent: 68, tip: "BMI is in the normal range." };
    if (bmi <= 29.9) return { label: "High", tone: "caution", percent: 82, tip: "BMI is above the normal range." };
    return { label: "Critical", tone: "risk", percent: 100, tip: "BMI is well above the normal range." };
  }, [bmi]);

  const vitalsRisk = useMemo(() => {
    const t = parseNumber(temperatureC);
    const o = parseNumber(spo2);
    if ((o && o < 92) || (t && t >= 39)) {
      return { label: "Critical", tone: "risk", percent: 100, tip: "Low oxygen or high fever needs urgent review." };
    }
    if ((o && o < 95) || (t && t >= 37.8)) {
      return { label: "Caution", tone: "caution", percent: 68, tip: "Vitals are outside the normal range." };
    }
    return { label: "Stable", tone: "ok", percent: 36, tip: "Current vitals look stable." };
  }, [temperatureC, spo2]);

  const hydrationStatus = useMemo(() => {
    if (!hydrationLiters) {
      return { label: "—", tone: "neutral", percent: 0, tip: "Add weight to estimate daily water intake." };
    }
    const percent = Math.min(100, Math.round((hydrationLiters / 4.5) * 100));
    return { label: `${hydrationLiters} L/day`, tone: "ok", percent, tip: "Daily water estimate based on body weight." };
  }, [hydrationLiters]);

  const contextTip = useMemo(() => {
    if (!bmi) return "Enter your height and weight to unlock BMI and hydration guidance.";
    if (vitalsRisk.label === "Critical") return "Your vitals suggest urgent attention. Contact a clinician now.";
    if (bmiStatus.label === "Normal") return "Your BMI is in normal range. Maintain your current weight and hydration.";
    if (bmiStatus.label === "Low") return "Your BMI is below normal. Consider a clinician review if weight loss is unplanned.";
    if (bmiStatus.label === "High") return "Your BMI is above normal. Review nutrition, activity, and follow-up advice.";
    return "Use symptoms, vitals, and profile details together for better AI guidance.";
  }, [bmi, bmiStatus.label, vitalsRisk.label]);

  const appointmentPath = useMemo(() => {
    if (!isAuthenticated) return "/login";
    if (role === "PATIENT") return "/patient/appointments";
    if (role === "DOCTOR") return "/doctor/appointments";
    if (role === "RECEPTIONIST") return "/receptionist/booking-desk";
    return "/notifications";
  }, [role, isAuthenticated]);

  const calendarPath = useMemo(() => {
    if (!isAuthenticated) return "/login";
    if (role === "PATIENT") return "/patient";
    if (role === "DOCTOR") return "/doctor/schedule";
    if (role === "RECEPTIONIST") return "/receptionist/booking-desk";
    return "/profile";
  }, [role, isAuthenticated]);

  const supportsRecognition = useMemo(() => {
    if (typeof window === "undefined") return false;
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }, []);

  const parsedDictionaryTerms = useMemo(
    () =>
      parseKeyValueLines(dictionaryInput).map((entry) => ({
        term: entry.left,
        replacement: entry.right,
      })),
    [dictionaryInput]
  );

  const parsedDotPhrases = useMemo(
    () =>
      parseKeyValueLines(dotPhrasesInput).map((entry) => ({
        shortcut: entry.left,
        content: entry.right,
        scope: "global",
      })),
    [dotPhrasesInput]
  );

  const parsedWorkflowTemplates = useMemo(
    () =>
      parseKeyValueLines(workflowTemplateInput, ":").map((entry) => ({
        workflow: entry.left.toLowerCase(),
        instructions: entry.right,
      })),
    [workflowTemplateInput]
  );

  const buildAssistantProfilePayload = useCallback(
    (overrides = {}) => {
      const medications = parseCsv(medicationsInput).map((row) => {
        const [name, dosage, schedule] = row.split("|").map((v) => String(v || "").trim());
        return { name, dosage, schedule };
      });
      return {
        conditions: overrides.conditions || parseCsv(conditionsInput),
        medications: overrides.medications || medications,
        notes: overrides.notes ?? notes,
        dictionaryTerms: overrides.dictionaryTerms || parsedDictionaryTerms,
        dotPhrases: overrides.dotPhrases || parsedDotPhrases,
        workflowTemplates: overrides.workflowTemplates || parsedWorkflowTemplates,
        autofillPreferences: {
          autoApplyHighConfidence:
            overrides.autofillPreferences?.autoApplyHighConfidence ?? autoApplyHighConfidence,
          confidenceThreshold:
            overrides.autofillPreferences?.confidenceThreshold ?? confidenceThreshold,
        },
      };
    },
    [
      autoApplyHighConfidence,
      confidenceThreshold,
      conditionsInput,
      medicationsInput,
      notes,
      parsedDictionaryTerms,
      parsedDotPhrases,
      parsedWorkflowTemplates,
    ]
  );

  const openChat = () => {
    if (!chatExpanded) {
      setChatExpanded(true);
      return;
    }
    if (chatSectionRef.current) {
      chatSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (chatInputRef.current) {
      chatInputRef.current.focus({ preventScroll: true });
    }
  };

  const buildOfflineReply = ({ prompt }) => {
    const tips = [];
    const temp = parseNumber(temperatureC);
    const oxygen = parseNumber(spo2);
    if (symptoms) tips.push(`You reported: ${symptoms}.`);
    if (Number.isFinite(temp) && temp >= 37.5) tips.push("Your temperature is elevated. Rest, hydrate, and monitor.");
    if (Number.isFinite(oxygen) && oxygen < 95) tips.push("Your SpO2 is low. Seek clinical help if this persists.");
    if (!tips.length) tips.push("Share symptoms, temperature, or SpO2 for more specific guidance.");
    return [
      "Assistant service is temporarily unavailable.",
      "Here is quick guidance based on your inputs:",
      ...tips.map((t) => `- ${t}`),
      "If symptoms are severe (chest pain, severe shortness of breath, confusion), seek emergency care.",
      prompt ? `You asked: "${prompt}"` : "",
    ]
      .filter(Boolean)
      .join("\n");
  };

  useEffect(() => {
    if (!chatExpanded) return;
    if (typeof window === "undefined") return;
    const raf = window.requestAnimationFrame(() => {
      if (chatSectionRef.current) {
        chatSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      if (chatInputRef.current) {
        chatInputRef.current.focus({ preventScroll: true });
      }
    });
    return () => window.cancelAnimationFrame(raf);
  }, [chatExpanded]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const handleOutsideClick = (event) => {
      const target = event.target;
      if (panelRef.current && panelRef.current.contains(target)) return;
      if (floatButtonRef.current && floatButtonRef.current.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [open]);

  if (loading) return null;
  if (typeof document === "undefined") return null;

  const setFieldValue = (field, value) => {
    if (!value) return;
    if (field === "symptoms") setSymptoms((prev) => `${prev}${prev ? ", " : ""}${value}`.trim());
    if (field === "question") setChatPrompt((prev) => `${prev}${prev ? " " : ""}${value}`.trim());
    if (field === "conditions") setConditionsInput((prev) => `${prev}${prev ? ", " : ""}${value}`.trim());
    if (field === "medications") setMedicationsInput((prev) => `${prev}${prev ? ", " : ""}${value}`.trim());
    if (field === "notes") setNotes((prev) => `${prev}${prev ? " " : ""}${value}`.trim());
    if (field === "formfill") setFormFillPrompt((prev) => `${prev}${prev ? " " : ""}${value}`.trim());
    if (field === "pasted-source") setFormFillPastedText((prev) => `${prev}${prev ? "\n" : ""}${value}`.trim());
    if (field === "focused") {
      const applied = appendTextToFocusedField(value);
      setFocusedFieldContext(getFocusedFieldContext());
      if (!applied) {
        setMsg('Click into a form field first, then use "Dictate at Cursor".');
      }
    }
  };

  const applyDictionaryTerms = (value) => {
    let next = String(value || "");
    for (const row of parsedDictionaryTerms) {
      const term = String(row.term || "").trim();
      const replacement = String(row.replacement || "").trim();
      if (!term || !replacement) continue;
      next = next.replace(new RegExp(`\\b${escapeRegex(term)}\\b`, "gi"), replacement);
    }
    return next;
  };

  const expandDotPhrase = (value, scope = "global") => {
    const text = normalizeVoiceText(value);
    if (!text.startsWith(".")) return text;
    const [shortcut, ...rest] = text.split(/\s+/);
    const match = parsedDotPhrases.find((row) => {
      const sameShortcut = String(row.shortcut || "").trim().toLowerCase() === shortcut.toLowerCase();
      const rowScope = String(row.scope || "global").toLowerCase();
      return sameShortcut && (rowScope === "global" || rowScope === scope.toLowerCase());
    });
    if (!match) return text;
    return [match.content, rest.join(" ")].filter(Boolean).join(rest.length ? " " : "");
  };

  const resolveVoiceCommand = (value) => {
    const normalized = normalizeVoiceCommand(value);
    if (!normalized) return null;
    if (["next field", "go to next field", "move to next field"].includes(normalized)) return "next-field";
    if (["previous field", "go to previous field", "move to previous field", "back field"].includes(normalized))
      return "previous-field";
    if (["next section", "go to next section", "move to next section"].includes(normalized)) return "next-section";
    if (["clear field", "erase field", "empty field"].includes(normalized)) return "clear-field";
    if (["submit form", "save form", "send form"].includes(normalized)) return "submit-form";
    return null;
  };

  const runVoiceCommand = (command) => {
    if (command === "next-field") {
      const field = focusNextField();
      setFocusedFieldContext(getFocusedFieldContext());
      setMsg(field ? `Focused ${field.label || field.name || "next field"}.` : "No next field was found.");
      return true;
    }
    if (command === "previous-field") {
      const field = focusPreviousField();
      setFocusedFieldContext(getFocusedFieldContext());
      setMsg(field ? `Focused ${field.label || field.name || "previous field"}.` : "No previous field was found.");
      return true;
    }
    if (command === "next-section") {
      const field = focusNextSection();
      setFocusedFieldContext(getFocusedFieldContext());
      setMsg(field ? `Jumped to ${field.section || field.label || "the next section"}.` : "No next section was found.");
      return true;
    }
    if (command === "clear-field") {
      const cleared = clearFocusedField();
      setFocusedFieldContext(getFocusedFieldContext());
      setMsg(cleared ? "Focused field cleared." : "Click into a field first so I know what to clear.");
      return cleared;
    }
    if (command === "submit-form") {
      const submitted = submitFocusedForm();
      setMsg(submitted ? "Form submitted." : "No form was available to submit from the current page.");
      return submitted;
    }
    return false;
  };

  const handleDictationTranscript = (field, transcript) => {
    const cleaned = normalizeVoiceText(transcript);
    if (!cleaned) return;
    if (field === "focused") {
      const command = resolveVoiceCommand(cleaned);
      if (command) {
        runVoiceCommand(command);
        return;
      }
    }
    const transformed = applyDictionaryTerms(expandDotPhrase(cleaned, field));
    setFieldValue(field, transformed);
  };

  const stopDictation = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsDictating(false);
    setDictationField("");
  };

  const dictationFieldLabel = {
    symptoms: "Symptoms",
    question: "Question",
    conditions: "Conditions",
    medications: "Medications",
    notes: "Notes",
    formfill: "AI fill request",
    "pasted-source": "Pasted source text",
    focused: focusedFieldContext?.label || "the focused field",
  }[dictationField] || dictationField;

  const startDictation = (field) => {
    setMsg("");
    if (!supportsRecognition) {
      setMsg("Voice dictation is not supported in this browser. Use Chrome/Edge for mic input.");
      return;
    }
    if (isDictating) stopDictation();
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;
    setDictationField(field);
    setIsDictating(true);

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results || [])
        .map((res) => (res?.[0]?.transcript || "").trim())
        .filter(Boolean)
        .join(" ");
      if (transcript) handleDictationTranscript(field, transcript);
    };
    recognition.onerror = (event) => {
      setMsg(event?.error ? `Voice input error: ${event.error}` : "Voice input failed");
      stopDictation();
    };
    recognition.onend = () => {
      stopDictation();
    };
    recognition.start();
  };

  const readAloud = (text) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setMsg("Text-to-speech not supported in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(String(text || "").slice(0, 4000));
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onstart = () => setSpeakerOn(true);
    utterance.onend = () => setSpeakerOn(false);
    utterance.onerror = () => setSpeakerOn(false);
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setSpeakerOn(false);
  };

  const pushHistory = (kind, title, content) => {
    const text = String(content || "").trim();
    if (!text) return;
    setHistory((prev) => [
      { id: `${kind}-${Date.now()}`, kind, title, content: text, createdAt: new Date().toISOString() },
      ...prev,
    ].slice(0, 12));
  };

  const appendChatMessage = (role, text) => {
    const clean = String(text || "").trim();
    if (!clean) return;
    setChatMessages((prev) => [
      ...prev,
      { id: `${role}-${Date.now()}`, role, text: clean, createdAt: new Date().toISOString() },
    ].slice(-30));
  };

  const buildChatContext = (messages) => {
    const recent = (messages || []).slice(-6).map((entry) => {
      const label = entry.role === "user" ? "User" : "Assistant";
      return `${label}: ${entry.text}`;
    });

    const adviceLines = [
      ...(advice?.alerts || []),
      ...(advice?.recommendations || []),
    ].filter(Boolean);

    return [
      "Use the following health context to answer the user's question.",
      `Upcoming appointment: ${reminderText}`,
      `Symptoms: ${symptoms || "none reported"}`,
      `Vitals: Temp ${temperatureC || "—"}°C, SpO2 ${spo2 || "—"}%, BMI ${bmi ?? "—"}, Hydration target ${hydrationLiters ? `${hydrationLiters} L/day` : "—"}`,
      adviceLines.length ? `Recent advice: ${adviceLines.join("; ")}` : "",
      recent.length ? `Recent chat:\n${recent.join("\n")}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  };

  const runAdvice = async () => {
    setAdviceBusy(true);
    setMsg("");
    try {
      const payload = {
        symptoms: parseCsv(symptoms),
        vitals: {
          temperatureC: parseNumber(temperatureC),
          spo2: parseNumber(spo2),
        },
      };
      const out = await getAssistantAdvice(payload);
      setAdvice(out?.advice || null);
      pushHistory(
        "advice",
        "Personal Advice",
        [
          ...(out?.advice?.alerts || []),
          ...(out?.advice?.recommendations || []),
          out?.advice?.disclaimer || "",
        ]
          .filter(Boolean)
          .join("\n")
      );
    } catch (err) {
      setMsg(err?.message || "Unable to get assistant advice");
    } finally {
      setAdviceBusy(false);
    }
  };

  const persistAssistantProfile = useCallback(
    async (payload, successMessage) => {
      await updateAssistantProfile(payload);
      setContext((prev) => ({
        ...(prev || {}),
        assistantProfile: {
          ...(prev?.assistantProfile || {}),
          ...payload,
        },
      }));
      setMsg(successMessage || `Assistant profile saved for hospital scope ${hospitalScope}.`);
    },
    [hospitalScope]
  );

  const saveProfile = async () => {
    setSaveBusy(true);
    setMsg("");
    try {
      const payload = buildAssistantProfilePayload();
      await persistAssistantProfile(payload);
    } catch (err) {
      setMsg(err?.message || "Failed to save assistant profile");
    } finally {
      setSaveBusy(false);
    }
  };

  const applyStarterPack = async (packId) => {
    const pack = getAssistantStarterPack(packId);
    if (!pack) return;
    setSaveBusy(true);
    setMsg("");
    try {
      const merged = mergeAssistantStarterPack(buildAssistantProfilePayload(), pack);
      setDictionaryInput(formatKeyValueLines(merged.dictionaryTerms || [], "term", "replacement"));
      setDotPhrasesInput(formatKeyValueLines(merged.dotPhrases || [], "shortcut", "content"));
      setWorkflowTemplateInput(
        formatKeyValueLines(merged.workflowTemplates || [], "workflow", "instructions", ": ")
      );
      await persistAssistantProfile(merged, `${pack.label} saved for hospital scope ${hospitalScope}.`);
    } catch (err) {
      setMsg(err?.message || `Failed to apply ${pack?.label || "starter pack"}.`);
    } finally {
      setSaveBusy(false);
    }
  };

  const askAssistant = async () => {
    const prompt = String(chatPrompt || "").trim();
    if (!prompt) return;
    appendChatMessage("user", prompt);
    setChatBusy(true);
    setMsg("");
    if (!isAuthenticated) {
      const fallback = "Please sign in to receive personalized assistant responses.";
      appendChatMessage("assistant", fallback);
      setChatAnswer(fallback);
      setChatBusy(false);
      return;
    }
    try {
      const pageContext = String(document?.body?.innerText || "").slice(0, 8000);
      const contextHint = buildChatContext([...chatMessages, { role: "user", text: prompt }]);
      const out = await chatAssistant({
        message: `${contextHint}\n\nUser question: ${prompt}`,
        userMessage: prompt,
        pageContext,
      });
      const answer = out?.answer || "";
      setChatAnswer(answer);
      appendChatMessage("assistant", answer);
      pushHistory("chat", prompt || "Ask AI", answer);
      setChatPrompt("");
    } catch (err) {
      const fallback = buildOfflineReply({ prompt });
      setMsg(err?.message || "Assistant is offline. Showing quick guidance.");
      setChatAnswer(fallback);
      appendChatMessage("assistant", fallback);
      pushHistory("chat", prompt || "Ask AI", fallback);
    } finally {
      setChatBusy(false);
    }
  };

  const handleQuickAsk = () => {
    setOpen(false);
    navigate("/ai/chatbot");
  };

  const buildFormFillSourceText = (extraction) => {
    const parts = [
      extraction?.rawText || "",
      extraction?.summary || "",
      extraction?.fields && Object.keys(extraction.fields).length ? JSON.stringify(extraction.fields) : "",
    ]
      .map((part) => String(part || "").trim())
      .filter(Boolean);
    return parts.join("\n\n").slice(0, 6000);
  };

  const combinedFormFillSource = [String(formFillSource || "").trim(), String(formFillPastedText || "").trim()]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 7000);

  const getConfidenceMeta = (value) => {
    const score = Math.max(0, Math.min(1, Number(value || 0)));
    if (score >= 0.85) return { score, label: "High", tone: "ok" };
    if (score >= 0.6) return { score, label: "Medium", tone: "caution" };
    return { score, label: "Low", tone: "risk" };
  };

  const buildEvidenceSnippet = ({ sourceText, value, evidence, fieldLabel }) => {
    const raw = String(sourceText || "").trim();
    if (!raw) return "";
    const needles = [value, evidence, fieldLabel]
      .map((part) => String(part || "").trim())
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);

    for (const needle of needles) {
      const index = raw.toLowerCase().indexOf(needle.toLowerCase());
      if (index >= 0) {
        const start = Math.max(0, index - 70);
        const end = Math.min(raw.length, index + needle.length + 90);
        return raw.slice(start, end).trim();
      }
    }

    return raw.slice(0, 160);
  };

  const parseJsonPayload = (text) => {
    const raw = String(text || "").trim();
    if (!raw) return null;

    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced?.[1]?.trim() || raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1).trim();
    if (!candidate) return null;

    try {
      return JSON.parse(candidate);
    } catch {
      return null;
    }
  };

  const buildFormFillPromptMessage = (fields, actions = []) => {
      const serializableFields = serializePageFormFields(fields).slice(0, 80);
      const serializableActions = serializePageActionTargets(actions).slice(0, 30);
      const template = resolveAutofillTemplate({ pathname: location.pathname, fields, pageTitle: document.title || "AfyaLink" });
      const adapter = resolvePageFormAdapter({ pathname: location.pathname, fields, pageTitle: document.title || "AfyaLink" });
      const savedTemplateNote =
        assistantProfile.workflowTemplates?.find((row) => String(row.workflow || "").toLowerCase() === template.id)?.instructions || "";
    const sourceKinds = [
      formFillPrompt.trim() ? "instruction" : "",
      formFillSource.trim() ? "upload" : "",
      formFillPastedText.trim() ? "pasted text" : "",
    ]
      .filter(Boolean)
      .join(", ");
    return [
      "You are AfyaLink's form autofill assistant for clinical and admin staff.",
      "Return valid JSON only. Do not use markdown or prose outside JSON.",
      'JSON schema: {"summary":"string","assignments":[{"fieldKey":"string","value":"string|boolean","confidence":0.0,"reason":"string","evidence":"string"}],"actions":[{"actionKey":"string","confidence":0.0,"reason":"string","evidence":"string"}],"unmatched":["string"]}.',
      "Rules:",
      "- Use only the provided fieldKey values.",
      "- Use only the provided actionKey values for actions.",
      "- Omit fields when the source does not clearly support a value.",
      "- Only suggest actions when the user instruction clearly requires a click or selection and the action is explicitly listed below.",
      "- Never invent actions. Do not return navigation or submit actions unless the instruction clearly asks for them.",
      "- For checkbox fields, use true or false.",
      "- For select and radio fields, use one of the listed option labels or values.",
      "- Be conservative with medical data. Never invent diagnoses or measurements.",
      `Workflow template: ${template.title}`,
      `Template focus: ${template.description}`,
      adapter?.id && adapter.id !== "generic" ? `Page adapter: ${adapter.title}` : "",
      adapter?.description ? `Adapter purpose: ${adapter.description}` : "",
      `Current role: ${role}`,
      `Hospital scope: ${hospitalScope}`,
      focusedFieldContext ? `Focused field: ${focusedFieldContext.label}${focusedFieldContext.section ? ` (${focusedFieldContext.section})` : ""}` : "",
      ...template.promptHints,
      ...(adapter?.promptHints || []),
      savedTemplateNote ? `Saved hospital workflow note: ${savedTemplateNote}` : "",
      sourceKinds ? `Source kinds: ${sourceKinds}` : "",
      assistantProfile.notes ? `Persistent assistant notes: ${assistantProfile.notes}` : "",
      `Route: ${location.pathname}`,
      `Page title: ${document.title || "AfyaLink"}`,
      `Available fields: ${JSON.stringify(serializableFields)}`,
      `Available actions: ${JSON.stringify(serializableActions)}`,
      `User instruction: ${String(formFillPrompt || "").trim() || "Use the uploaded or dictated source to fill the current form."}`,
      combinedFormFillSource ? `Source text: ${combinedFormFillSource}` : "Source text: none",
    ]
      .filter(Boolean)
      .join("\n\n");
  };

  const buildDraftFromAssignments = (fields, actions, payload) => {
    const resolved = resolveAiAssignments(fields, Array.isArray(payload?.assignments) ? payload.assignments : []);
    const assignmentItems = resolved.map((item, index) => {
      const assignment = item.assignment || {};
      const confidence = getConfidenceMeta(assignment.confidence);
      return {
        id: `${item.field?.key || assignment.fieldKey || assignment.label || "draft"}-${index}`,
        kind: "field",
        matched: Boolean(item.field),
        fieldKey: item.field?.key || assignment.fieldKey || assignment.key || "",
        fieldLabel: item.fieldLabel,
        value: assignment.value,
        reason: assignment.reason || "",
        evidence: assignment.evidence || "",
        sourcePreview: buildEvidenceSnippet({
          sourceText: combinedFormFillSource,
          value: assignment.value,
          evidence: assignment.evidence,
          fieldLabel: item.fieldLabel,
        }),
        confidence,
        assignment,
      };
    });

    const resolvedActions = resolveAiActions(actions, Array.isArray(payload?.actions) ? payload.actions : []);
    const actionItems = resolvedActions.map((item, index) => {
      const action = item.action || {};
      const confidence = getConfidenceMeta(action.confidence);
      return {
        id: `${item.target?.key || action.actionKey || action.label || "action"}-${index}`,
        kind: "action",
        matched: Boolean(item.target),
        fieldKey: item.target?.key || action.actionKey || action.key || "",
        fieldLabel: item.actionLabel,
        value: item.target?.helpText || item.target?.label || action.label || action.actionType || "Execute action",
        reason: action.reason || "",
        evidence: action.evidence || "",
        sourcePreview: buildEvidenceSnippet({
          sourceText: combinedFormFillSource,
          value: item.target?.helpText || item.target?.label || action.label || action.actionType,
          evidence: action.evidence,
          fieldLabel: item.actionLabel,
        }),
        confidence,
        assignment: action,
      };
    });

    return [...assignmentItems, ...actionItems];
  };

  const handleFormFillFile = async (file) => {
    if (!file) return;
    if (!isAuthenticated) {
      setMsg("Sign in to extract a photo or document into this form.");
      return;
    }
    setExtractBusy(true);
    setMsg("");
    try {
      const out = await extractDocument(file);
      const sourceText = buildFormFillSourceText(out?.extraction || {});
      if (!sourceText) {
        throw new Error("The upload did not return enough readable text to fill this form.");
      }
      setFormFillSource(sourceText);
      setFormFillFileName(file.name || "uploaded file");
      setMsg(`Ready to autofill using ${file.name || "the uploaded file"}.`);
    } catch (err) {
      setMsg(err?.message || "Failed to extract text from the uploaded file.");
      setFormFillSource("");
      setFormFillFileName("");
    } finally {
      setExtractBusy(false);
      if (uploadInputRef.current) uploadInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  };

  const buildAutofillSourceKinds = () =>
    [
      formFillPrompt.trim() ? "instruction" : "",
      formFillSource.trim() ? "upload" : "",
      formFillPastedText.trim() ? "pasted-text" : "",
    ].filter(Boolean);

  const captureAutofillAudit = async ({ eventType, template, summary, items = [], unmatched = [] }) => {
    try {
      await logAssistantAutofillAudit({
        eventType,
        templateId: template?.id || activeTemplate?.id || "generic",
        templateTitle: template?.title || activeTemplate?.title || "General Form Fill",
        route: location.pathname,
        summary,
        sourceKinds: buildAutofillSourceKinds(),
        unmatched,
        items: items.map((item) => ({
          fieldKey: item.fieldKey,
          fieldLabel: item.fieldLabel,
          value: item.value,
          confidence: item.confidence?.score ?? item.confidence ?? null,
          evidence: item.evidence || "",
          reason: item.reason || item.applyResult?.reason || "",
          status: item.applied ? "applied" : item.matched ? "queued" : "unmatched",
        })),
      });
    } catch (err) {
      console.warn("Assistant autofill audit failed:", err?.message || err);
    }
  };

  const runPageAutofill = async () => {
    if (!isAuthenticated) {
      setMsg("Sign in to use AI autofill on this page.");
      return;
    }
    const { fields, actions } = refreshPageFields();
    if (!fields.length) {
      if (!actions.length) {
        setMsg("No fillable form fields or reviewed actions were detected on this page.");
        return;
      }
    }
    if (!fields.length && actions.length && !String(formFillPrompt || "").trim() && !String(combinedFormFillSource || "").trim()) {
      setMsg("Add an instruction, dictate what to do, or upload a photo/document first.");
      return;
    }
    if (!String(formFillPrompt || "").trim() && !String(combinedFormFillSource || "").trim()) {
      setMsg("Add an instruction, dictate what to fill, or upload a photo/document first.");
      return;
    }

    setFormFillBusy(true);
    setMsg("");
    setFormFillReport(null);
    setFormFillDraft(null);
    setDraftSelection({});
    setReviewItemId("");

    try {
      const out = await chatAssistant({
        message: buildFormFillPromptMessage(fields, actions),
        userMessage: formFillPrompt || `Autofill ${location.pathname}`,
        pageContext: String(document?.body?.innerText || "").slice(0, 3000),
      });
      const payload = parseJsonPayload(out?.answer || "");
      if (!payload?.assignments?.length && !payload?.actions?.length) {
        throw new Error("The assistant did not return a usable field mapping or reviewed action for this page.");
      }

      const template = resolveAutofillTemplate({ pathname: location.pathname, fields, pageTitle: document.title || "AfyaLink" });
      let items = buildDraftFromAssignments(fields, actions, payload);
      let autoAppliedFilled = [];
      let autoAppliedSkipped = [];
      if (autoApplyHighConfidence) {
        const autoCandidates = items.filter(
          (item) => item.kind === "field" && item.matched && item.confidence.score >= confidenceThreshold
        );
        if (autoCandidates.length) {
          const results = applyAiAssignments(
            fields,
            autoCandidates.map((item) => ({
              fieldKey: item.fieldKey,
              value: item.value,
              confidence: item.confidence.score,
            }))
          );
          const resultMap = new Map(autoCandidates.map((item, index) => [item.id, results[index]]));
          items = items.map((item) => {
            const result = resultMap.get(item.id);
            if (!result) return item;
            return {
              ...item,
              applied: result.ok,
              applyResult: result,
              lastAppliedAt: result.ok ? new Date().toISOString() : "",
            };
          });
          autoAppliedFilled = results.filter((entry) => entry.ok);
          autoAppliedSkipped = results.filter((entry) => !entry.ok);
        }
      }
      const selected = Object.fromEntries(
        items.filter((item) => item.matched && !item.applied).map((item) => [item.id, true])
      );
      const draftedCount = items.filter((item) => item.matched).length;
      const queuedCount = items.filter((item) => item.matched && !item.applied).length;
      const draftedActionCount = items.filter((item) => item.kind === "action" && item.matched).length;
      const autoAppliedCount = autoAppliedFilled.length;
      const baseSummary =
        payload.summary ||
        `Drafted ${draftedCount} item${draftedCount === 1 ? "" : "s"} for review.`;
      const summary = autoAppliedCount
        ? `${baseSummary} Auto-applied ${autoAppliedCount} high-confidence field${autoAppliedCount === 1 ? "" : "s"} and left ${queuedCount} for review.`
        : baseSummary;

      setFormFillDraft({
        template,
        summary,
        items,
        unmatched: Array.isArray(payload.unmatched) ? payload.unmatched : [],
      });
      setDraftSelection(selected);
      setReviewItemId(items.find((item) => item.matched)?.id || items[0]?.id || "");
      if (autoAppliedCount || autoAppliedSkipped.length) {
        setFormFillReport({
          summary:
            autoAppliedCount > 0
              ? `Auto-applied ${autoAppliedCount} high-confidence field${autoAppliedCount === 1 ? "" : "s"}.`
              : "No high-confidence fields were auto-applied.",
          filled: autoAppliedFilled,
          skipped: autoAppliedSkipped,
          unmatched: [],
        });
      }
      await captureAutofillAudit({
        eventType: "drafted",
        template,
        summary,
        items,
        unmatched: Array.isArray(payload.unmatched) ? payload.unmatched : [],
      });
      if (autoAppliedCount) {
        await captureAutofillAudit({
          eventType: "applied",
          template,
          summary: `Auto-applied ${autoAppliedCount} high-confidence fields.`,
          items: items.filter((item) => item.applied),
        });
      }
      setMsg(
        draftedActionCount
          ? `${summary} ${draftedActionCount} reviewed action${draftedActionCount === 1 ? "" : "s"} also need explicit approval.`
          : `${summary} Review the remaining items below before applying them.`
      );
    } catch (err) {
      setMsg(err?.message || "AI autofill failed for this page.");
    } finally {
      setFormFillBusy(false);
    }
  };

  const applyDraftAssignments = async ({ onlySelected = true, selectedIds = null } = {}) => {
    if (!formFillDraft?.items?.length) {
      setMsg("No autofill draft is ready yet.");
      return;
    }

    const allowedIds = Array.isArray(selectedIds) ? new Set(selectedIds) : null;
    const candidates = formFillDraft.items.filter(
      (item) =>
        item.matched &&
        !item.applied &&
        (!onlySelected || (allowedIds ? allowedIds.has(item.id) : draftSelection[item.id]))
    );
    if (!candidates.length) {
      setMsg(onlySelected ? "Select at least one drafted item to apply." : "No unapplied drafted items left.");
      return;
    }

    setApplyBusy(true);
    setMsg("");
    try {
      const { fields, actions } = refreshPageFields();
      const fieldCandidates = candidates.filter((item) => item.kind !== "action");
      const actionCandidates = candidates.filter((item) => item.kind === "action");
      const fieldResults = applyAiAssignments(
        fields,
        fieldCandidates.map((item) => ({
          fieldKey: item.fieldKey,
          value: item.value,
        }))
      );
      const actionResults = applyAiActions(
        actions,
        actionCandidates.map((item) => ({
          actionKey: item.fieldKey,
          confidence: item.confidence?.score,
        }))
      );

      const resultMap = new Map([
        ...fieldCandidates.map((item, index) => [item.id, fieldResults[index]]),
        ...actionCandidates.map((item, index) => [item.id, actionResults[index]]),
      ]);
      const nextItems = formFillDraft.items.map((item) => {
        const result = resultMap.get(item.id);
        if (!result) return item;
        return {
          ...item,
          applied: result.ok,
          applyResult: result,
          lastAppliedAt: new Date().toISOString(),
        };
      });

      const results = [...fieldResults, ...actionResults];
      const filled = results.filter((entry) => entry.ok);
      const skipped = results.filter((entry) => !entry.ok);
      const summary = filled.length
        ? `Applied ${filled.length} reviewed item${filled.length === 1 ? "" : "s"}.`
        : "No reviewed items were applied.";

      setFormFillDraft((prev) => ({
        ...(prev || {}),
        items: nextItems,
      }));
      setFormFillReport({
        summary,
        filled,
        skipped,
        unmatched: formFillDraft.unmatched || [],
      });
      pushHistory(
        "autofill",
        "AI Autofill Applied",
        [
          summary,
          filled.length ? `Filled: ${filled.map((item) => `${item.field} = ${item.value}`).join("; ")}` : "",
          skipped.length ? `Skipped: ${skipped.map((item) => `${item.field} (${item.reason})`).join("; ")}` : "",
        ]
          .filter(Boolean)
          .join("\n")
      );
      await captureAutofillAudit({
        eventType: "applied",
        template: formFillDraft.template,
        summary,
        items: nextItems.filter((item) => resultMap.has(item.id)),
        unmatched: formFillDraft.unmatched || [],
      });
      setMsg(summary);
    } catch (err) {
      setMsg(err?.message || "Failed to apply the reviewed autofill draft.");
    } finally {
      setApplyBusy(false);
    }
  };

  const summarizePage = async () => {
    setSummaryBusy(true);
    setMsg("");
    try {
      const pageContext = String(document?.body?.innerText || "").slice(0, 8000);
      const out = await summarizeAssistantPage({ pageContext });
      setChatAnswer(out?.summary || "");
      appendChatMessage("assistant", out?.summary || "");
      pushHistory("summary", "Page Summary", out?.summary || "");
    } catch (err) {
      setMsg(err?.message || "Failed to summarize page");
    } finally {
      setSummaryBusy(false);
    }
  };

  const clearMemory = async () => {
    setMsg("");
    try {
      await clearAssistantMemory();
      setChatMessages([]);
      setChatAnswer("");
      setHistory([]);
      setMsg("Assistant memory cleared for this hospital.");
    } catch (err) {
      setMsg(err?.message || "Failed to clear assistant memory.");
    }
  };

  const busy = loadingContext || adviceBusy || chatBusy || summaryBusy || saveBusy || formFillBusy || extractBusy || applyBusy;

  const exportHealthReport = () => {
    if (typeof window === "undefined") return;
    const report = `
${aiName} Personal Assistant
Status: ${reminderText}

BMI: ${bmi || "—"}
Hydration: ${hydrationStatus.label}
Vitals Risk: ${vitalsRisk.label}

Symptoms: ${symptoms || "—"}
Temperature: ${temperatureC || "—"}
SpO2: ${spo2 || "—"}
Height: ${heightCm || "170"}
Weight: ${weightKg || "70"}

Conditions: ${conditionsInput || "—"}
Medications: ${medicationsInput || "—"}
Notes: ${notes || "—"}

Latest Output:
${chatAnswer || advice?.recommendations?.join("; ") || "—"}
`.trim();
    const popup = window.open("", "_blank", "width=900,height=700");
    if (!popup) {
      setMsg("Pop-up blocked. Allow pop-ups to export the report as PDF.");
      return;
    }
    popup.document.write(`<pre style="font:14px/1.6 system-ui;padding:24px;white-space:pre-wrap;">${report}</pre>`);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  const copySummary = async () => {
    const text = chatAnswer || history[0]?.content || advice?.recommendations?.join("\n") || "";
    if (!text) {
      setMsg("Nothing to copy yet.");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setMsg("Summary copied.");
    } catch {
      setMsg("Could not copy summary.");
    }
  };

  const selectedReviewItem = formFillDraft?.items?.find((item) => item.id === reviewItemId) || null;

  const floatingUI = (
    <>
      <button
        type="button"
        className={`ai-float ai-float-icon-only${hasIcon ? "" : " ai-float-fallback-only"}${open ? " is-open" : ""}`}
        onClick={() => setOpen((prev) => !prev)}
        title={launcherLabel}
        aria-label={launcherLabel}
        aria-expanded={open}
        data-label={launcherLabel}
        style={{ position: "fixed", right: 20, bottom: 20, zIndex: 2147483647 }}
        ref={floatButtonRef}
      >
        <span className={`ai-float-icon${hasIcon ? "" : " ai-float-icon-fallback"}`} aria-hidden="true">
          {hasIcon ? (
            <img src={launcherIconSrc} alt="" onError={handleLauncherIconError} decoding="async" loading="lazy" />
          ) : (
            <span className="ai-float-monogram">{launcherInitials}</span>
          )}
        </span>
        <span className="ai-float-presence" aria-hidden="true" />
        <span className="sr-only">{launcherLabel}</span>
      </button>

      {open && (
        <>
          <aside
            className="ai-panel premium"
            role="dialog"
            aria-label={`${aiName} assistant`}
            style={{ position: "fixed", right: 16, bottom: 88, zIndex: 2147483646 }}
            ref={panelRef}
          >
            <div className="ai-panel-head">
              <div className="ai-header-main">
                <div>
                  <h3>{aiName} Personal Assistant</h3>
                  <p className="muted">{reminderText}</p>
                  {aiLocked && (
                    <p className="muted" style={{ color: "#f59e0b", fontWeight: 600 }}>
                      AI is disabled by admin settings.
                    </p>
                  )}
                </div>
                <div className="ai-header-actions">
                  <button type="button" className="btn-secondary" onClick={() => navigate(appointmentPath)} disabled={aiLocked}>
                    Add Appointment
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => navigate(calendarPath)} disabled={aiLocked}>
                    View Calendar
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-compact"
                    onClick={handleQuickAsk}
                    disabled={aiLocked}
                  >
                    Ask
                  </button>
                  <button type="button" className="icon-btn" onClick={() => navigate("/profile")} aria-label="Assistant settings">
                    ⚙
                  </button>
                </div>
              </div>
              <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Close assistant">
                ×
              </button>
            </div>

            <div className="ai-panel-body">
              {loadingContext && <p className="muted">Loading...</p>}
              {msg && <div className="auth-info">{msg}</div>}
              {isDictating && (
                <div className="card ai-status-card">
                  <strong>Mic is on:</strong> Listening for {dictationFieldLabel}
                  <button type="button" className="btn-secondary" onClick={stopDictation}>
                    Stop Mic
                  </button>
                </div>
              )}
              {speakerOn && (
                <div className="card ai-status-card">
                  <strong>Audio is playing.</strong>
                  <button type="button" className="btn-secondary" onClick={stopSpeaking}>
                    Stop Audio
                  </button>
                </div>
              )}

              <div className="ai-health-grid">
                <div className={`card ai-kpi ai-kpi-${bmiStatus.tone}`} title={bmiStatus.tip}>
                  <span className="muted">⚖ BMI</span>
                  <strong>{bmi || "—"}</strong>
                  <small>{bmiStatus.label}</small>
                  <div className="ai-progress"><span style={{ width: `${bmiStatus.percent}%` }} /></div>
                </div>
                <div className={`card ai-kpi ai-kpi-${hydrationStatus.tone}`} title={hydrationStatus.tip}>
                  <span className="muted">💧 Hydration</span>
                  <strong>{hydrationStatus.label}</strong>
                  <small>{hydrationHint}</small>
                  <div className="ai-progress"><span style={{ width: `${hydrationStatus.percent}%` }} /></div>
                </div>
                <div className={`card ai-kpi ai-kpi-${vitalsRisk.tone}`} title={vitalsRisk.tip}>
                  <span className="muted">❤ Vitals Risk</span>
                  <strong>{vitalsRisk.label}</strong>
                  <small>{vitalsRisk.tip}</small>
                  <div className="ai-progress"><span style={{ width: `${vitalsRisk.percent}%` }} /></div>
                </div>
              </div>

              <div className="card ai-tip-card">
                <strong>AI Tip</strong>
                <p className="muted">{contextTip}</p>
              </div>

              <div className="card form ai-autofill-card">
                <div className="ai-autofill-head">
                  <div>
                    <h4>AI Autofill Anywhere</h4>
                    <p className="muted">
                      Dictate at the cursor, paste source text, or upload a photo/document and let AI draft the current page form for review.
                    </p>
                  </div>
                  <button type="button" className="btn-secondary btn-compact" onClick={refreshPageFields}>
                    Refresh Fields
                  </button>
                </div>
                <div className="ai-autofill-meta">
                  <span className="ai-autofill-pill">{pageFieldCount} field{pageFieldCount === 1 ? "" : "s"} detected</span>
                  {pageActionCount ? (
                    <span className="ai-autofill-pill secondary">{pageActionCount} safe action{pageActionCount === 1 ? "" : "s"}</span>
                  ) : null}
                  {activeTemplate ? <span className="ai-autofill-pill secondary">{activeTemplate.title}</span> : null}
                  {activeAdapter?.id && activeAdapter.id !== "generic" ? (
                    <span className="ai-autofill-pill secondary">Adapter: {activeAdapter.title}</span>
                  ) : null}
                  {pageFieldPreview.length ? (
                    <span className="muted">Preview: {pageFieldPreview.join(", ")}</span>
                  ) : (
                    <span className="muted">Open any form page and refresh to let AI map the fields.</span>
                  )}
                  {activeTemplate?.description ? <span className="muted">{activeTemplate.description}</span> : null}
                  <span className="muted">Hospital scope: {hospitalScope}</span>
                  {focusedFieldContext ? (
                    <span className="muted">
                      Focused field: <strong>{focusedFieldContext.label}</strong>
                      {focusedFieldContext.section ? ` • ${focusedFieldContext.section}` : ""}
                    </span>
                  ) : (
                    <span className="muted">Click into any page field, then use Dictate at Cursor or the navigation commands.</span>
                  )}
                </div>
                <div className="ai-autofill-command-grid">
                  <button type="button" className="btn-secondary btn-compact" onClick={() => startDictation("focused")} disabled={!supportsRecognition || busy}>
                    🎤 Dictate at Cursor
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-compact"
                    onClick={() => {
                      const field = focusPreviousField();
                      setFocusedFieldContext(getFocusedFieldContext());
                      setMsg(field ? `Focused ${field.label || field.name || "previous field"}.` : "No previous field was found.");
                    }}
                  >
                    Previous Field
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-compact"
                    onClick={() => {
                      const field = focusNextField();
                      setFocusedFieldContext(getFocusedFieldContext());
                      setMsg(field ? `Focused ${field.label || field.name || "next field"}.` : "No next field was found.");
                    }}
                  >
                    Next Field
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-compact"
                    onClick={() => {
                      const field = focusNextSection();
                      setFocusedFieldContext(getFocusedFieldContext());
                      setMsg(field ? `Jumped to ${field.section || field.label || "the next section"}.` : "No next section was found.");
                    }}
                  >
                    Next Section
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-compact"
                    onClick={() => {
                      const cleared = clearFocusedField();
                      setFocusedFieldContext(getFocusedFieldContext());
                      setMsg(cleared ? "Focused field cleared." : "Click into a field first so I know what to clear.");
                    }}
                  >
                    Clear Field
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-compact"
                    onClick={() => {
                      const submitted = submitFocusedForm();
                      setMsg(submitted ? "Form submitted." : "No form was available to submit from the current page.");
                    }}
                  >
                    Submit Form
                  </button>
                </div>
                <label>Instruction for this page</label>
                <textarea
                  rows={3}
                  value={formFillPrompt}
                  onChange={(e) => setFormFillPrompt(e.target.value)}
                  placeholder="Example: use this referral letter to fill the patient details and transfer summary."
                />
                <label>Pasted source text</label>
                <textarea
                  rows={3}
                  value={formFillPastedText}
                  onChange={(e) => setFormFillPastedText(e.target.value)}
                  placeholder="Paste referral note, claim letter, lab request, discharge summary, or copied text here."
                />
                <div className="ai-inline-actions">
                  <button type="button" className="btn-secondary" onClick={() => startDictation("formfill")} disabled={!supportsRecognition || busy}>
                    🎤 Dictate Fill Request
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => startDictation("pasted-source")} disabled={!supportsRecognition || busy}>
                    🎤 Dictate Source Text
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => uploadInputRef.current?.click()} disabled={busy}>
                    Upload Image / PDF
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => cameraInputRef.current?.click()} disabled={busy}>
                    Take Photo
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={runPageAutofill}
                    disabled={busy || (!formFillPrompt.trim() && !combinedFormFillSource.trim())}
                  >
                    {formFillBusy ? "Filling..." : "AI Fill This Page"}
                  </button>
                </div>
                <div className="ai-smart-review">
                  <label className="ai-smart-review-toggle">
                    <input
                      type="checkbox"
                      checked={autoApplyHighConfidence}
                      onChange={(e) => setAutoApplyHighConfidence(e.target.checked)}
                    />
                    <span>Auto-apply only high-confidence fields</span>
                  </label>
                  <div className="ai-smart-review-threshold">
                    <span>Threshold: {Math.round(confidenceThreshold * 100)}%</span>
                    <input
                      type="range"
                      min="0.6"
                      max="0.95"
                      step="0.05"
                      value={confidenceThreshold}
                      onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                    />
                  </div>
                  <p className="muted">
                    Lower-confidence or unmatched fields stay queued in the review list with evidence and provenance.
                  </p>
                </div>
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept="image/*,.pdf,.jpg,.jpeg,.png,.webp"
                  style={{ display: "none" }}
                  onChange={(e) => handleFormFillFile(e.target.files?.[0])}
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: "none" }}
                  onChange={(e) => handleFormFillFile(e.target.files?.[0])}
                />
                {extractBusy ? <p className="muted">Extracting text from your upload...</p> : null}
                {formFillFileName || formFillPastedText.trim() ? (
                  <div className="ai-autofill-source">
                    <strong>Source ready:</strong> {formFillFileName || "Pasted text"}
                    {formFillPastedText.trim() ? <span className="muted">Includes pasted/copied text.</span> : null}
                    <button
                      type="button"
                      className="btn-secondary btn-compact"
                      onClick={() => {
                        setFormFillSource("");
                        setFormFillFileName("");
                        setFormFillPastedText("");
                      }}
                    >
                      Clear Source
                    </button>
                  </div>
                ) : null}
                {formFillDraft ? (
                  <div className="card ai-response-card ai-autofill-review">
                    <div className="ai-autofill-review-head">
                      <div>
                        <h4>Review Before Apply</h4>
                        <p className="muted">{formFillDraft.summary}</p>
                      </div>
                      <div className="ai-inline-actions">
                        <button type="button" className="btn-primary btn-compact" onClick={() => applyDraftAssignments({ onlySelected: true })} disabled={applyBusy}>
                          {applyBusy ? "Applying..." : "Approve Checked"}
                        </button>
                        <button type="button" className="btn-secondary btn-compact" onClick={() => applyDraftAssignments({ onlySelected: false })} disabled={applyBusy}>
                          Apply All
                        </button>
                        <button
                          type="button"
                          className="btn-secondary btn-compact"
                          onClick={() => {
                            setFormFillDraft(null);
                            setDraftSelection({});
                            setReviewItemId("");
                          }}
                        >
                          Clear Draft
                        </button>
                      </div>
                    </div>
                    <div className="ai-review-list">
                      {formFillDraft.items.map((item) => (
                        <div key={item.id} className={`ai-review-item${item.id === reviewItemId ? " active" : ""}${item.applied ? " applied" : ""}${!item.matched ? " missing" : ""}`}>
                          <label className="ai-review-check">
                            <input
                              type="checkbox"
                              checked={Boolean(draftSelection[item.id])}
                              disabled={!item.matched || item.applied}
                              onChange={(e) => setDraftSelection((prev) => ({ ...prev, [item.id]: e.target.checked }))}
                            />
                            <span>
                              <span className={`ai-review-kind ${item.kind === "action" ? "action" : "field"}`}>
                                {item.kind === "action" ? "Action" : "Field"}
                              </span>
                              <strong>{item.fieldLabel}</strong>
                              <small>{String(item.value ?? "—")}</small>
                            </span>
                          </label>
                          <div className="ai-review-meta">
                            <span className={`ai-review-confidence ${item.confidence.tone}`}>{item.confidence.label} {Math.round(item.confidence.score * 100)}%</span>
                            {item.applied ? <span className="ai-review-status">{item.kind === "action" ? "Executed" : "Applied"}</span> : null}
                            {!item.matched ? <span className="ai-review-status warning">Needs manual mapping</span> : null}
                            <button type="button" className="btn-secondary btn-compact" onClick={() => setReviewItemId(item.id)}>
                              Evidence
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {formFillDraft.unmatched?.length ? (
                      <>
                        <strong>Unmatched source items</strong>
                        <ul>
                          {formFillDraft.unmatched.map((item, index) => (
                            <li key={`draft-unmatched-${index}`}>{item}</li>
                          ))}
                        </ul>
                      </>
                    ) : null}
                  </div>
                ) : null}
                {formFillReport ? (
                  <div className="card ai-response-card ai-autofill-report">
                    <h4>Autofill Result</h4>
                    <p className="muted">{formFillReport.summary}</p>
                    {formFillReport.filled?.length ? (
                      <>
                        <strong>Filled</strong>
                        <ul>
                          {formFillReport.filled.map((item, index) => (
                            <li key={`filled-${index}`}>
                              {item.field}: {String(item.value)}
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : null}
                    {formFillReport.skipped?.length ? (
                      <>
                        <strong>Skipped</strong>
                        <ul>
                          {formFillReport.skipped.map((item, index) => (
                            <li key={`skipped-${index}`}>
                              {item.field}: {item.reason}
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : null}
                    {formFillReport.unmatched?.length ? (
                      <>
                        <strong>Unmatched source items</strong>
                        <ul>
                          {formFillReport.unmatched.map((item, index) => (
                            <li key={`unmatched-${index}`}>{item}</li>
                          ))}
                        </ul>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="card form">
                <label>Symptoms (comma-separated)</label>
                <input
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  placeholder="fever, cough, headache"
                  title="Use commas to separate symptoms or use voice input."
                />
                <div className="ai-inline-actions">
                  <button type="button" className="btn-secondary" onClick={() => startDictation("symptoms")} disabled={!supportsRecognition || busy}>
                    🎤 Fill Symptoms
                  </button>
                </div>
                <div className="row-actions">
                  <div>
                    <label title="Normal adult temperature is about 36.1°C to 37.2°C.">Temperature (°C)</label>
                    <input value={temperatureC} onChange={(e) => setTemperatureC(e.target.value)} placeholder="36.8" />
                  </div>
                  <div>
                    <label title="Normal SpO2 is usually 95% to 100%.">SpO2 (%)</label>
                    <input value={spo2} onChange={(e) => setSpo2(e.target.value)} placeholder="98" />
                  </div>
                </div>
                <div className="row-actions">
                  <div>
                    <label title="Used for BMI calculation.">Height (cm)</label>
                    <input value={heightCm} onChange={(e) => setHeightCm(e.target.value)} placeholder="170" />
                  </div>
                  <div>
                    <label title="Used for BMI and hydration guidance.">Weight (kg)</label>
                    <input value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="70" />
                  </div>
                </div>
                <button type="button" className="btn-primary" onClick={runAdvice} disabled={busy}>
                  {adviceBusy ? "Analyzing..." : "Get Personal Advice"}
                </button>
              </div>

              {advice && (
                <div className="card ai-response-card">
                  <h4>Alerts</h4>
                  <ul>
                    {(advice.alerts || []).map((a, i) => (
                      <li key={`a-${i}`}>{a}</li>
                    ))}
                    {!advice.alerts?.length && <li>No critical alerts detected.</li>}
                  </ul>
                  <h4>Recommendations</h4>
                  <ul>
                    {(advice.recommendations || []).map((r, i) => (
                      <li key={`r-${i}`}>{r}</li>
                    ))}
                  </ul>
                  <p className="muted">{advice.disclaimer}</p>
                  <div className="ai-inline-actions">
                    <button type="button" className="btn-secondary" onClick={() => readAloud([...(advice.alerts || []), ...(advice.recommendations || [])].join(". "))}>
                      Audio: Read Advice
                    </button>
                  </div>
                </div>
              )}

              <div className="card form" ref={chatSectionRef}>
                <div className="ai-compact-actions">
                  <button
                    type="button"
                    className="btn-secondary btn-compact"
                    onClick={handleQuickAsk}
                  >
                    Ask
                  </button>
                  <button type="button" className="btn-secondary btn-compact" onClick={summarizePage} disabled={busy}>
                    {summaryBusy ? "..." : "Summary"}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-compact"
                    onClick={copySummary}
                    disabled={!chatAnswer && !history.length && !advice}
                  >
                    Copy
                  </button>
                  <button type="button" className="btn-secondary btn-compact" onClick={exportHealthReport}>
                    PDF
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-compact"
                    onClick={clearMemory}
                    disabled={!chatMessages.length}
                  >
                    Clear Memory
                  </button>
                </div>
                {chatExpanded ? (
                  <>
                    <label>Question</label>
                    <textarea
                      className="ai-chat-input"
                      ref={chatInputRef}
                      rows={3}
                      value={chatPrompt}
                      onChange={(e) => setChatPrompt(e.target.value)}
                      placeholder="Ask anything about your health or this page..."
                    />
                    <div className="ai-inline-actions">
                      <button type="button" className="btn-secondary btn-compact" onClick={() => startDictation("question")} disabled={!supportsRecognition || busy}>
                        🎤 Fill Question
                      </button>
                      <button type="button" className="btn-primary btn-compact" onClick={askAssistant} disabled={busy || !chatPrompt.trim()}>
                        {chatBusy ? "Thinking..." : "Send"}
                      </button>
                    </div>
                  </>
                ) : null}
                {chatAnswer && (
                  <div className="card ai-response-card">
                    <h4>Assistant Response</h4>
                    <p style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>{chatAnswer}</p>
                    <div className="ai-inline-actions">
                      <button type="button" className="btn-secondary" onClick={() => readAloud(chatAnswer)}>
                        Audio: Read Response
                      </button>
                    </div>
                  </div>
                )}
                <div className="card ai-history-card">
                  <h4>Chat History</h4>
                  <div className="ai-history-list">
                    {chatMessages.map((entry) => (
                      <div key={entry.id} className="ai-history-item ai-history-chat">
                        <strong>{entry.role === "user" ? "You" : "Assistant"}</strong>
                        <p>{entry.text}</p>
                        <small>{new Date(entry.createdAt).toLocaleTimeString()}</small>
                      </div>
                    ))}
                    {!chatMessages.length ? (
                      <p className="muted">Your chat messages will appear here for this session.</p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="card form">
                <h4>Health Profile for Better Advice</h4>
                <label>Known conditions (comma-separated)</label>
                <input
                  value={conditionsInput}
                  onChange={(e) => setConditionsInput(e.target.value)}
                  placeholder="asthma, diabetes"
                />
                <div className="ai-inline-actions">
                  <button type="button" className="btn-secondary" onClick={() => startDictation("conditions")} disabled={!supportsRecognition || busy}>
                    Mic: Fill Conditions
                  </button>
                </div>
                <label>Medication reminders</label>
                <input
                  value={medicationsInput}
                  onChange={(e) => setMedicationsInput(e.target.value)}
                  placeholder="Paracetamol | 500mg | 8 hourly, Insulin | 10 units | morning"
                />
                <div className="ai-inline-actions">
                  <button type="button" className="btn-secondary" onClick={() => startDictation("medications")} disabled={!supportsRecognition || busy}>
                    Mic: Fill Medications
                  </button>
                </div>
                <label>Notes</label>
                <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
                <div className="ai-inline-actions">
                  <button type="button" className="btn-secondary" onClick={() => startDictation("notes")} disabled={!supportsRecognition || busy}>
                    Mic: Fill Notes
                  </button>
                </div>
                <button type="button" className="btn-secondary" onClick={saveProfile} disabled={saveBusy}>
                  {saveBusy ? "Saving..." : "Save Assistant Profile"}
                </button>
              </div>

              <div className="card form">
                <h4>Assistant Shortcuts & Hospital Templates</h4>
                <p className="muted">
                  These settings are saved for <strong>{hospitalScope}</strong>, so teams can keep different shortcuts and workflow habits by hospital.
                </p>
                <div className="ai-starter-pack-grid">
                  {starterPacks.map((pack) => {
                    const recommended = recommendedStarterPackIds.includes(pack.id);
                    return (
                      <div key={pack.id} className={`ai-starter-pack-card${recommended ? " recommended" : ""}`}>
                        <div>
                          <strong>{pack.label}</strong>
                          <p className="muted">{pack.description}</p>
                          <small className="muted">
                            {pack.recommendedRoles?.length ? `Best for: ${pack.recommendedRoles.join(", ")}` : "Reusable hospital starter pack"}
                          </small>
                        </div>
                        <button
                          type="button"
                          className={recommended ? "btn-primary btn-compact" : "btn-secondary btn-compact"}
                          onClick={() => applyStarterPack(pack.id)}
                          disabled={saveBusy}
                        >
                          {saveBusy ? "Saving..." : "Apply Pack"}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <label>Custom dictionary terms</label>
                <textarea
                  rows={3}
                  value={dictionaryInput}
                  onChange={(e) => setDictionaryInput(e.target.value)}
                  placeholder={"sha => Social Health Authority\nspo2 => SpO2"}
                />
                <label>Dot phrases / macros</label>
                <textarea
                  rows={3}
                  value={dotPhrasesInput}
                  onChange={(e) => setDotPhrasesInput(e.target.value)}
                  placeholder={".claim => Claim reviewed against SHA member card and invoice.\n.admit => Patient admitted, handover completed, vitals stable."}
                />
                <label>Workflow templates</label>
                <textarea
                  rows={4}
                  value={workflowTemplateInput}
                  onChange={(e) => setWorkflowTemplateInput(e.target.value)}
                  placeholder={"claims: Always capture member number, payer, provider, procedure, total amount.\nreferrals: Keep handover concise and include urgency, destination, and medication notes."}
                />
                <div className="ai-inline-actions">
                  <button type="button" className="btn-secondary btn-compact" onClick={saveProfile} disabled={saveBusy}>
                    {saveBusy ? "Saving..." : "Save Shortcuts"}
                  </button>
                </div>
                <p className="muted">
                  In cursor mode you can say voice commands like “next field”, “previous field”, “next section”, “clear field”, or “submit form”.
                </p>
              </div>
            </div>
          </aside>
          {selectedReviewItem ? (
            <aside
              className="ai-evidence-drawer"
              role="dialog"
              aria-label="Autofill evidence"
              style={{ position: "fixed", right: 548, bottom: 88, zIndex: 2147483645 }}
            >
              <div className="ai-evidence-head">
                <div>
                  <h4>Confidence + Evidence</h4>
                  <p className="muted">{selectedReviewItem.fieldLabel}</p>
                </div>
                <button type="button" className="icon-btn" onClick={() => setReviewItemId("")} aria-label="Close evidence drawer">
                  ×
                </button>
              </div>
              <div className="ai-evidence-body">
                <div className="ai-evidence-stat">
                  <span className={`ai-review-confidence ${selectedReviewItem.confidence.tone}`}>
                    {selectedReviewItem.confidence.label} {Math.round(selectedReviewItem.confidence.score * 100)}%
                  </span>
                  <span className={`ai-review-kind ${selectedReviewItem.kind === "action" ? "action" : "field"}`}>
                    {selectedReviewItem.kind === "action" ? "Action" : "Field"}
                  </span>
                  <strong>{selectedReviewItem.kind === "action" ? "Suggested action" : "Suggested value"}</strong>
                  <p>{String(selectedReviewItem.value ?? "—")}</p>
                </div>
                <div className="ai-evidence-stat">
                  <strong>AI reasoning</strong>
                  <p>{selectedReviewItem.reason || "No reasoning returned."}</p>
                </div>
                <div className="ai-evidence-stat">
                  <strong>Evidence quote</strong>
                  <p>{selectedReviewItem.evidence || "No explicit quote returned."}</p>
                </div>
                <div className="ai-evidence-stat">
                  <strong>Source snippet</strong>
                  <p>{selectedReviewItem.sourcePreview || "No source snippet matched the current draft."}</p>
                </div>
                <div className="ai-inline-actions">
                  {!selectedReviewItem.applied ? (
                    <button
                      type="button"
                      className="btn-primary btn-compact"
                      onClick={() => applyDraftAssignments({ onlySelected: true, selectedIds: [selectedReviewItem.id] })}
                      disabled={!selectedReviewItem.matched || applyBusy}
                    >
                        {selectedReviewItem.kind === "action" ? "Execute This Action" : "Apply This Field"}
                      </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn-secondary btn-compact"
                    onClick={() => setDraftSelection((prev) => ({ ...prev, [selectedReviewItem.id]: !prev[selectedReviewItem.id] }))}
                    disabled={!selectedReviewItem.matched || selectedReviewItem.applied}
                  >
                    {draftSelection[selectedReviewItem.id] ? "Uncheck" : "Check"} for Apply
                  </button>
                </div>
              </div>
            </aside>
          ) : null}
        </>
      )}
    </>
  );

  return createPortal(floatingUI, document.body);
}
