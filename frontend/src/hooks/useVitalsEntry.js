import { useEffect, useState } from "react";
import { getPatientById } from "../services/patientApi";
import { listEncounters } from "../services/encounter/queries";
import { resolveNurseEscalation } from "../services/encounter/mutations";
import {
  publishPatientSelected,
  publishFormOpened,
  publishFieldFocused,
  publishFieldChanged,
  publishFormSubmitted,
} from "../ai/neuroedgeEventHelpers";

const INITIAL_FORM = {
  temperature: "",
  pulse: "",
  systolicBP: "",
  diastolicBP: "",
  spo2: "",
  painScale: "",
  note: "",
};

export function useVitalsEntry(patientId = "") {
  const [patient, setPatient] = useState(null);
  const [encounter, setEncounter] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [msg, setMsg] = useState("");
  const [escalating, setEscalating] = useState(false);

  useEffect(() => {
    if (!patientId) {
      setPatient(null);
      setEncounter(null);
      return;
    }
    getPatientById(patientId)
      .then((loadedPatient) => {
        setPatient(loadedPatient);
        publishPatientSelected(loadedPatient);
      })
      .catch(() => setPatient(null));
    listEncounters({ patientId, limit: 1 })
      .then((rows) => {
        const items = Array.isArray(rows) ? rows : [];
        setEncounter(items[0] || null);
      })
      .catch(() => setEncounter(null));
  }, [patientId]);

  useEffect(() => {
    publishFormOpened("Vitals Entry");
  }, []);

  const readinessLabel = (() => {
    if (!encounter?._id) return "No active visit";
    if (encounter?.closeout?.canClose) return "Transfer/Discharge Ready";
    const missing = Array.isArray(encounter?.closeout?.missingRequirements)
      ? encounter.closeout.missingRequirements.join(", ")
      : "";
    return missing ? `Hold: ${missing}` : "Review clinician handoffs";
  })();

  const escalationLabel = (() => {
    const summary = encounter?.escalationSummary;
    if (!summary?.count) return "";
    if (summary.openCount > 0) return "Escalated • Awaiting response";
    return "Escalation resolved";
  })();

  function getFieldCounts(nextForm) {
    const values = Object.values(nextForm || {});
    const completed = values.filter((value) => value !== "" && value !== null && value !== undefined).length;
    const remaining = values.length - completed;
    return { completedFields: completed, remainingFields: remaining };
  }

  function updateField(key, value) {
    setForm((prev) => {
      const nextForm = { ...prev, [key]: value };
      const counts = getFieldCounts(nextForm);
      publishFieldChanged(counts.completedFields, counts.remainingFields);
      return nextForm;
    });
  }

  function saveDraft() {
    const patientName = patient
      ? [patient.firstName, patient.lastName].filter(Boolean).join(" ")
      : "selected patient";
    publishFormSubmitted("Vitals Entry", "draft");
    setMsg(`Vitals draft prepared for ${patientName || "patient"}.`);
  }

  async function escalateEncounter() {
    if (!encounter?._id) {
      setMsg("No active visit to escalate.");
      return;
    }
    try {
      setEscalating(true);
      const res = await resolveNurseEscalation(encounter._id, {
        note: `Bedside vitals review requested for ${[patient?.firstName, patient?.lastName].filter(Boolean).join(" ") || "patient"}.`,
      });
      setMsg(`Escalation sent to ${res?.recipients || 0} recipient(s).`);
    } catch (e) {
      setMsg(e?.message || "Failed to send escalation.");
    } finally {
      setEscalating(false);
    }
  }

  return {
    patient,
    encounter,
    form,
    msg,
    setMsg,
    escalating,
    readinessLabel,
    escalationLabel,
    updateField,
    saveDraft,
    escalateEncounter,
    setForm,
  };
}

export default useVitalsEntry;
