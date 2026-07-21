import { useCallback, useEffect, useState } from "react";
import { getPatient } from "../services/patientApi";
import { getClinicalDraft, saveClinicalDraft, promoteClinicalDraft } from "../services/clinicalDraftApi";

export function useDoctorClinicalNotes(patientId, draftType = "DOCTOR_NOTE") {
  const [patient, setPatient] = useState(null);
  const [note, setNote] = useState("");
  const [summary, setSummary] = useState("");
  const [msg, setMsg] = useState("");
  const [draftSaved, setDraftSaved] = useState(false);
  const [draftEditing, setDraftEditing] = useState(true);
  const [draftSaving, setDraftSaving] = useState(false);
  const [promoting, setPromoting] = useState(false);

  const loadContext = useCallback(async () => {
    if (!patientId) {
      setPatient(null);
      setSummary("");
      setNote("");
      setDraftSaved(false);
      setDraftEditing(true);
      return;
    }

    try {
      const [patientData, draftData] = await Promise.all([
        getPatient(patientId),
        getClinicalDraft(draftType, patientId),
      ]);
      setPatient(patientData || null);
      setSummary(draftData?.summary || "");
      setNote(draftData?.note || draftData?.content || "");
      setDraftSaved(Boolean(draftData));
      setDraftEditing(false);
    } catch (err) {
      setMsg(err?.message || "Failed to load note draft.");
    }
  }, [draftType, patientId]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  const saveDraft = useCallback(async () => {
    if (!patientId) {
      setMsg("Select a patient before saving a draft.");
      return false;
    }
    setDraftSaving(true);
    setMsg("");
    try {
      await saveClinicalDraft(draftType, patientId, { summary, note });
      setDraftSaved(true);
      setDraftEditing(false);
      setMsg("Draft saved.");
      return true;
    } catch (err) {
      setMsg(err?.message || "Could not save draft.");
      return false;
    } finally {
      setDraftSaving(false);
    }
  }, [draftType, note, patientId, summary]);

  const promoteDraft = useCallback(async () => {
    if (!patientId) {
      setMsg("Select a patient before promoting the draft.");
      return false;
    }
    setPromoting(true);
    setMsg("");
    try {
      await promoteClinicalDraft(draftType, patientId);
      setDraftSaved(true);
      setDraftEditing(false);
      setMsg("Note promoted to visit record.");
      return true;
    } catch (err) {
      setMsg(err?.message || "Could not promote draft.");
      return false;
    } finally {
      setPromoting(false);
    }
  }, [draftType, patientId]);

  return {
    patient,
    note,
    summary,
    setNote,
    setSummary,
    msg,
    setMsg,
    draftSaved,
    draftEditing,
    setDraftEditing,
    draftSaving,
    promoting,
    saveDraft,
    promoteDraft,
    refresh: loadContext,
  };
}

export default useDoctorClinicalNotes;
