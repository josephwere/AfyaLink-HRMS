const WORKFLOW_LIFECYCLE = {
  Scheduled: { label: "Scheduled", tone: "neutral", action: "Check in patient" },
  CheckedIn: { label: "Checked in", tone: "warning", action: "Mark provider ready" },
  ProviderReady: { label: "Provider ready", tone: "connected", action: "Start consultation" },
  InConsultation: { label: "In consultation", tone: "connected", action: "Consultation active" },
  Completed: { label: "Completed", tone: "connected", action: "Completed" },
  Cancelled: { label: "Cancelled", tone: "risk", action: "Cancelled" },
  NoShow: { label: "No show", tone: "risk", action: "No show" },
};

function normalizeLifecycleStatus(status) {
  const raw = String(status || "")
    .trim()
    .toLowerCase();
  if (!raw) return "Scheduled";
  if (["scheduled", "created", "confirmed", "confirmed", "created"].includes(raw)) return "Scheduled";
  if (["checkedin", "checked_in", "waiting"].includes(raw)) return "CheckedIn";
  if (["providerready", "provider_ready", "ready_for_provider"].includes(raw)) return "ProviderReady";
  if (["inconsultation", "in_consultation", "in_encounter", "opening_encounter"].includes(raw)) return "InConsultation";
  if (["completed", "done"].includes(raw)) return "Completed";
  if (["cancelled", "canceled", "cancel", "expired"].includes(raw)) return "Cancelled";
  if (["noshow", "no_show", "no-show"].includes(raw)) return "NoShow";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function getAppointmentLifecycleState(item = {}) {
  const key = normalizeLifecycleStatus(item?.status);
  return WORKFLOW_LIFECYCLE[key] || WORKFLOW_LIFECYCLE.Scheduled;
}

export function canStartRemoteConsultation(item = {}) {
  const normalizedMode = String(item?.consultationMode || "IN_PERSON").toUpperCase();
  if (!["VOICE", "VIDEO"].includes(normalizedMode)) return false;
  const lifecycle = getAppointmentLifecycleState(item);
  return lifecycle.label === "Provider ready" || lifecycle.label === "In consultation";
}

export function getLifecycleTransitionHint(item = {}) {
  return WORKFLOW_LIFECYCLE[normalizeLifecycleStatus(item?.status)] || WORKFLOW_LIFECYCLE.Scheduled;
}

export default {
  getAppointmentLifecycleState,
  canStartRemoteConsultation,
  getLifecycleTransitionHint,
};
