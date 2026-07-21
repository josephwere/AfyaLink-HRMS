import { useCallback, useEffect, useState } from "react";
import {
  cancelAppointment,
  createAppointment,
  listAppointments,
  listDoctors,
  listPatients,
} from "../services/appointmentsApi";

const DEFAULT_FORM = {
  patient: "",
  doctor: "",
  scheduledAt: "",
  reason: "",
};

export function useAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [patientsCursor, setPatientsCursor] = useState(null);
  const [patientsHasMore, setPatientsHasMore] = useState(false);
  const [patientsLoadingMore, setPatientsLoadingMore] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [a, p, u] = await Promise.all([
        listAppointments(),
        listPatients({ cursorMode: 1, limit: 50 }),
        listDoctors(),
      ]);

      setAppointments(Array.isArray(a) ? a : a?.items || []);
      const patientItems = Array.isArray(p) ? p : p?.items || [];
      setPatients(patientItems);
      setPatientsCursor(p?.nextCursor || null);
      setPatientsHasMore(Boolean(p?.hasMore));
      setDoctors((u || []).filter((x) => x.role === "DOCTOR"));
    } catch {
      setError("Failed to load appointments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const loadMorePatients = useCallback(async () => {
    if (!patientsCursor || patientsLoadingMore) return;
    setPatientsLoadingMore(true);
    try {
      const data = await listPatients({
        cursorMode: 1,
        limit: 50,
        cursor: patientsCursor,
      });
      const patientItems = Array.isArray(data) ? data : data?.items || [];
      setPatients((prev) => [...prev, ...patientItems]);
      setPatientsCursor(data?.nextCursor || null);
      setPatientsHasMore(Boolean(data?.hasMore));
    } catch {
      // ignore
    } finally {
      setPatientsLoadingMore(false);
    }
  }, [patientsCursor, patientsLoadingMore]);

  const createAppointmentEntry = useCallback(async (payload) => {
    setError("");
    try {
      await createAppointment({
        ...payload,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Nairobi",
      });
      setForm(DEFAULT_FORM);
      await loadAll();
    } catch {
      setError("Failed to create appointment");
    }
  }, [loadAll]);

  const cancelAppointmentEntry = useCallback(async (id) => {
    if (!window.confirm("Cancel appointment?")) return;

    try {
      await cancelAppointment(id);
      await loadAll();
    } catch {
      window.alert("Cancellation failed");
    }
  }, [loadAll]);

  return {
    appointments,
    patients,
    patientsCursor,
    patientsHasMore,
    patientsLoadingMore,
    doctors,
    form,
    setForm,
    loading,
    error,
    loadAll,
    loadMorePatients,
    createAppointmentEntry,
    cancelAppointmentEntry,
  };
}

export default useAppointments;
