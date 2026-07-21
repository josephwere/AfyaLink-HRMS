import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../utils/auth";
import { getPatient } from "../services/patientApi";
import { listAppointments } from "../services/appointmentWorkflow";
import encounterService from "../services/encounter/service";
import { listTransfers } from "../services/transferApi";
import { createBillingHandoff, resolveNurseEscalation } from "../services/encounter/mutations";
import { listEncounters } from "../services/encounter/queries";

const DEFAULT_FORM = {
  symptoms: "",
  assessment: "",
  diagnosis: "",
  diagnosisCode: "",
  treatmentPlan: "",
  followUp: "",
  labTests: "",
  billingItems: "",
};

const DEFAULT_TRANSFER_FORM = {
  toHospitalId: "",
  reasons: "",
  handoverSummary: "",
  scopes: [],
};

const DEFAULT_CLOSEOUT_STATUS = {
  visit: "PENDING",
  diagnosis: "PENDING",
  billing: "PENDING",
  prescriptions: "PENDING",
};

export function useDoctorConsultation(patientId, focus = "") {
  const { user } = useAuth();
  const [, setSearchParams] = useSearchParams();
  const [patient, setPatient] = useState(null);
  const [encounter, setEncounter] = useState(null);
  const [encounterLoading, setEncounterLoading] = useState(false);
  const [encounterError, setEncounterError] = useState("");
  const [form, setForm] = useState(DEFAULT_FORM);
  const [msg, setMsg] = useState("");
  const [promoting, setPromoting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [resolvingEscalation, setResolvingEscalation] = useState(false);
  const [transferHospitals, setTransferHospitals] = useState([]);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferForm, setTransferForm] = useState(DEFAULT_TRANSFER_FORM);
  const [closeoutStatus, setCloseoutStatus] = useState(DEFAULT_CLOSEOUT_STATUS);
  const [resolvedPolicy, setResolvedPolicy] = useState(null);
  const [escalationSummary, setEscalationSummary] = useState(null);

  const focusLabel = useMemo(() => {
    const normalized = String(focus || "").toUpperCase();
    switch (normalized) {
      case "PRESCRIPTION":
        return "Prescription workflow";
      case "DIAGNOSIS":
        return "Diagnosis handoff";
      case "BILLING":
        return "Billing handoff";
      default:
        return "";
    }
  }, [focus]);

  const loadPatientContext = useCallback(async () => {
    if (!patientId) {
      setPatient(null);
      return;
    }
    try {
      const patientData = await getPatient(patientId);
      setPatient(patientData || null);
    } catch {
      setPatient(null);
    }
  }, [patientId]);

  const loadEncounter = useCallback(async () => {
    if (!patientId) {
      setEncounter(null);
      return;
    }
    setEncounterLoading(true);
    setEncounterError("");
    try {
      const rows = await listEncounters({ patientId, limit: 1 });
      const activeEncounter = Array.isArray(rows) ? rows[0] || null : null;
      setEncounter(activeEncounter);
      if (activeEncounter?.closeout) {
        setCloseoutStatus({
          visit: activeEncounter.closeout.canClose ? "READY" : "PENDING",
          diagnosis: activeEncounter.closeout.requireDiagnosisBeforeClose ? "PENDING" : "OPTIONAL",
          billing: activeEncounter.closeout.requireBillingHandoffWhenPaymentsEnabled ? "PENDING" : "OPTIONAL",
          prescriptions: activeEncounter.closeout.requirePrescriptionWhenPharmacyEnabled ? "PENDING" : "OPTIONAL",
        });
      }
    } catch (err) {
      setEncounterError(err?.message || "Could not load encounter.");
      setEncounter(null);
    } finally {
      setEncounterLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    void loadPatientContext();
    void loadEncounter();
  }, [loadPatientContext, loadEncounter]);

  useEffect(() => {
    const loadTransferContext = async () => {
      setTransferLoading(true);
      try {
        const res = await listTransfers({ scope: "facility", limit: 100 });
        const items = Array.isArray(res?.items) ? res.items : [];
        const hospitalList = items
          .map((row) => row?.toHospital || row?.fromHospital || null)
          .filter(Boolean);
        setTransferHospitals(hospitalList);
      } catch {
        setTransferHospitals([]);
      } finally {
        setTransferLoading(false);
      }
    };
    void loadTransferContext();
  }, []);

  const updateField = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const toggleTransferScope = useCallback((scope, checked) => {
    setTransferForm((prev) => ({
      ...prev,
      scopes: checked ? [...new Set([...(prev.scopes || []), scope])] : (prev.scopes || []).filter((item) => item !== scope),
    }));
  }, []);

  const saveDraft = useCallback(async () => {
    if (!patientId) {
      setMsg("Select a patient before saving a draft.");
      return false;
    }
    setPromoting(true);
    try {
      await encounterService.create?.({
        patientId,
        doctorId: user?.id || user?._id,
        summary: form.treatmentPlan || form.assessment || form.symptoms,
        form,
      });
      setMsg("Draft saved.");
      return true;
    } catch (err) {
      setMsg(err?.message || "Could not save draft.");
      return false;
    } finally {
      setPromoting(false);
    }
  }, [form, patientId, user?.id, user?._id]);

  const promoteDraft = useCallback(async () => {
    if (!patientId) {
      setMsg("Select a patient before promoting the draft.");
      return false;
    }
    setPromoting(true);
    try {
      const created = await encounterService.create?.({ patientId, doctorId: user?.id || user?._id, summary: form.treatmentPlan || form.assessment || form.symptoms, form });
      setEncounter(created || null);
      setMsg("Draft promoted to visit.");
      setSearchParams((prev) => ({ ...Object.fromEntries(prev.entries()), patientId }));
      return true;
    } catch (err) {
      setMsg(err?.message || "Could not promote draft.");
      return false;
    } finally {
      setPromoting(false);
    }
  }, [form, patientId, setSearchParams, user?.id, user?._id]);

  const handleApplyCloseoutEffects = useCallback(async () => {
    if (!encounter?._id) return false;
    setHandoffLoading(true);
    try {
      await encounterService.applyCloseoutEffects?.(encounter._id, { focus, form });
      setMsg("Diagnosis and lab handoff sent.");
      return true;
    } catch (err) {
      setMsg(err?.message || "Could not send diagnosis and labs.");
      return false;
    } finally {
      setHandoffLoading(false);
    }
  }, [encounter?._id, focus, form]);

  const sendBillingHandoff = useCallback(async () => {
    if (!encounter?._id) return false;
    setBillingLoading(true);
    try {
      await createBillingHandoff(encounter._id, { focus, form });
      setMsg("Billing handoff sent.");
      return true;
    } catch (err) {
      setMsg(err?.message || "Could not send billing handoff.");
      return false;
    } finally {
      setBillingLoading(false);
    }
  }, [encounter?._id, focus, form]);

  const resolveEscalation = useCallback(async () => {
    if (!encounter?._id) return false;
    setResolvingEscalation(true);
    try {
      const resolved = await resolveNurseEscalation(encounter._id, { note: "Clinician reviewed student escalation and resumed visit workflow." });
      setEscalationSummary((prev) => ({ ...(prev || {}), openCount: 0, unreadMine: 0, count: 0, latestBody: prev?.latestBody || "" }));
      setMsg(resolved?.message || "Escalation resolved.");
      return true;
    } catch (err) {
      setMsg(err?.message || "Could not resolve escalation.");
      return false;
    } finally {
      setResolvingEscalation(false);
    }
  }, [encounter?._id]);

  const completeVisit = useCallback(async () => {
    if (!encounter?._id) return false;
    setClosing(true);
    try {
      await encounterService.close?.(encounter._id);
      setMsg("Visit closed.");
      return true;
    } catch (err) {
      setMsg(err?.message || "Could not close visit.");
      return false;
    } finally {
      setClosing(false);
    }
  }, [encounter?._id]);

  const submitTransferRequest = useCallback(async () => {
    if (!patientId || !transferForm.toHospitalId) {
      setMsg("Choose a destination hospital before sending a transfer request.");
      return false;
    }
    setTransferLoading(true);
    try {
      await encounterService.create?.({
        patientId,
        transfer: transferForm,
      });
      setMsg("Transfer request sent.");
      return true;
    } catch (err) {
      setMsg(err?.message || "Could not send transfer request.");
      return false;
    } finally {
      setTransferLoading(false);
    }
  }, [patientId, transferForm]);

  return {
    patient,
    form,
    msg,
    promoting,
    closing,
    handoffLoading,
    billingLoading,
    resolvingEscalation,
    transferHospitals,
    transferLoading,
    transferForm,
    setTransferForm,
    encounter,
    encounterLoading,
    encounterError,
    updateField,
    toggleTransferScope,
    submitTransferRequest,
    saveDraft,
    promoteDraft,
    completeVisit,
    handleApplyCloseoutEffects,
    sendBillingHandoff,
    resolveEscalation,
    closeoutStatus,
    resolvedPolicy,
    escalationSummary,
    focusLabel,
    CONSENT_SCOPES: ["TREATMENT", "DIAGNOSTIC", "TRANSFER"],
    DEFAULT_SCOPES: ["TREATMENT"],
  };
}

export default useDoctorConsultation;
