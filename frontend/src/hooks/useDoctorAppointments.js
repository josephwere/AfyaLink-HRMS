import { useCallback, useEffect, useState } from "react";
import {
  createAppointment,
  deleteAppointment,
  listAppointments,
  updateAppointment,
} from "../services/appointmentWorkflow";

export function useDoctorAppointments() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listAppointments();
      setItems(Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      setItems([]);
      setError(err?.message || "Failed to load appointments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  const create = useCallback(async (payload) => {
    const result = await createAppointment(payload);
    await loadAppointments();
    return result;
  }, [loadAppointments]);

  const remove = useCallback(async (id) => {
    const result = await deleteAppointment(id);
    await loadAppointments();
    return result;
  }, [loadAppointments]);

  const update = useCallback(async (id, payload = { status: "Completed" }) => {
    const result = await updateAppointment(id, payload);
    await loadAppointments();
    return result;
  }, [loadAppointments]);

  return { items, loading, error, loadAppointments, create, remove, update };
}

export default useDoctorAppointments;
