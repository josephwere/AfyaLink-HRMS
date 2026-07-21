import { useCallback, useEffect, useMemo, useState } from "react";
import { createAppointment, listAppointmentSuggestions } from "../services/appointmentWorkflow";
import { listPatients } from "../services/patientApi";

const defaultForm = {
  patient: "",
  serviceType: "General Consultation",
  consultationMode: "IN_PERSON",
  scheduledAt: "",
  reason: "",
  doctor: "",
};

export function useReceptionistBooking() {
  const [patientQuery, setPatientQuery] = useState("");
  const [patients, setPatients] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState(defaultForm);

  const loadPatients = useCallback(async (query) => {
    const q = String(query || "").trim();
    if (!q) {
      setPatients([]);
      return;
    }
    setLoadingPatients(true);
    try {
      const rows = await listPatients({ q, limit: 10 });
      setPatients(Array.isArray(rows) ? rows : []);
    } catch {
      setPatients([]);
    } finally {
      setLoadingPatients(false);
    }
  }, []);

  const loadSuggestions = useCallback(async () => {
    if (!form.serviceType) {
      setSuggestions([]);
      return;
    }
    try {
      const params = new URLSearchParams({
        serviceType: form.serviceType,
        consultationMode: form.consultationMode,
        limit: "5",
      });
      if (form.scheduledAt) {
        params.set("preferredDate", new Date(form.scheduledAt).toISOString());
      }
      const res = await listAppointmentSuggestions({ serviceType: form.serviceType, consultationMode: form.consultationMode, preferredDate: form.scheduledAt, limit: 5 });
      setSuggestions(Array.isArray(res?.items) ? res.items : []);
    } catch {
      setSuggestions([]);
    }
  }, [form.consultationMode, form.scheduledAt, form.serviceType]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadPatients(patientQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [loadPatients, patientQuery]);

  useEffect(() => {
    void loadSuggestions();
  }, [loadSuggestions]);

  const submit = useCallback(async (payloadOverride = null) => {
    if (!form.patient) {
      setMsg("Pick a patient first.");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      const payload = payloadOverride || {
        patient: form.patient,
        serviceType: form.serviceType,
        consultationMode: form.consultationMode,
        scheduledAt: form.scheduledAt,
        reason: form.reason || undefined,
        doctor: form.doctor || undefined,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Nairobi",
      };
      await createAppointment(payload);
      setMsg("Appointment booked from front desk.");
      setForm((prev) => ({
        ...prev,
        scheduledAt: "",
        reason: "",
        doctor: "",
      }));
    } catch (err) {
      setMsg(err?.message || "Failed to book appointment");
    } finally {
      setSaving(false);
    }
  }, [form.consultationMode, form.doctor, form.patient, form.reason, form.scheduledAt, form.serviceType]);

  const bookSuggestion = useCallback(async (suggestion) => {
    const slotDate = suggestion?.appointmentTime ? new Date(suggestion.appointmentTime) : null;
    if (!slotDate || Number.isNaN(slotDate.getTime())) {
      setMsg("Suggestion is not ready.");
      return;
    }
    await submit({
      patient: form.patient,
      serviceType: form.serviceType,
      consultationMode: form.consultationMode,
      scheduledAt: slotDate.toISOString(),
      doctor: suggestion.doctorId,
      reason: form.reason || undefined,
    });
  }, [form.consultationMode, form.patient, form.reason, form.serviceType, submit]);

  const selectedPatient = useMemo(() => patients.find((patient) => String(patient._id) === String(form.patient)) || null, [form.patient, patients]);

  return {
    patientQuery,
    setPatientQuery,
    patients,
    suggestions,
    saving,
    loadingPatients,
    msg,
    form,
    setForm,
    submit,
    bookSuggestion,
    selectedPatient,
  };
}

export default useReceptionistBooking;
