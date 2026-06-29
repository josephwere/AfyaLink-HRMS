function normalizeText(value, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

export function buildContextBridgeState(aiContext = {}) {
  const workspace = aiContext.workspace || {};
  const actor = aiContext.actor || {};
  const subject = aiContext.subject || {};
  const ui = aiContext.ui || {};

  return {
    workflow: normalizeText(aiContext.workflow, "General assistance"),
    selection: normalizeText(aiContext.selection, ""),
    contextSummary: {
      workspace: workspace.module || "Workspace",
      role: actor.role || "User",
      subject: subject.patientId ? "Patient context available" : "No patient context",
      focus: ui.focusedField || "",
    },
  };
}
