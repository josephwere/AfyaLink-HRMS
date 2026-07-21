import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../utils/auth";
import {
  getDoctorAvailability,
  saveDoctorAvailability,
} from "../services/appointmentWorkflow";

function buildDefaultRows() {
  return [1, 2, 3, 4, 5].map((dayOfWeek) => ({
    dayOfWeek,
    startTime: "08:00",
    endTime: "17:00",
    appointmentSlots: 12,
    isAvailable: true,
    consultationAvailable: true,
    modes: {
      chat: true,
      voice: false,
      video: false,
      inPerson: true,
    },
    notes: "",
  }));
}

export function useDoctorAvailability() {
  const { user } = useAuth();
  const [rows, setRows] = useState(buildDefaultRows());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [availabilitySaved, setAvailabilitySaved] = useState(false);
  const [availabilityEditing, setAvailabilityEditing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setMsg("");
    try {
      const res = await getDoctorAvailability(user.id);
      const items = Array.isArray(res?.items) ? res.items : [];
      setRows(items.length ? items : buildDefaultRows());
      setAvailabilitySaved(true);
      setAvailabilityEditing(false);
    } catch (err) {
      setRows(buildDefaultRows());
      setMsg(err?.message || "Could not load your schedule.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const patchRow = useCallback((index, updates) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...updates } : row)));
  }, []);

  const patchModes = useCallback((index, key, value) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, modes: { ...(row.modes || {}), [key]: value } } : row)));
  }, []);

  const save = useCallback(async () => {
    if (!user?.id) return true;
    setSaving(true);
    setMsg("");
    try {
      await saveDoctorAvailability(user.id, { items: rows });
      setMsg("Availability saved.");
      setAvailabilitySaved(true);
      setAvailabilityEditing(false);
      await load();
      return true;
    } catch (err) {
      setMsg(err?.message || "Could not save availability.");
      throw err;
    } finally {
      setSaving(false);
    }
  }, [load, rows, user?.id]);

  const todayIndex = useMemo(() => new Date().getDay(), []);
  const todayRow = useMemo(() => rows.find((row) => Number(row.dayOfWeek) === todayIndex) || null, [rows, todayIndex]);

  return {
    rows,
    loading,
    saving,
    msg,
    availabilitySaved,
    availabilityEditing,
    setAvailabilityEditing,
    todayIndex,
    todayRow,
    patchRow,
    patchModes,
    load,
    save,
    setRows,
  };
}

export default useDoctorAvailability;
