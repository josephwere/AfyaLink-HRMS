import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { listTrainingTrackers, updateTrainingDay, upsertTrainingTracker } from "../services/trainingTrackerApi";
import apiFetch from "../utils/apiFetch";

const TRACKABLE_ROLES = [
  "SUPER_ADMIN",
  "SYSTEM_ADMIN",
  "HOSPITAL_ADMIN",
  "DEVELOPER",
  "DOCTOR",
  "NURSE",
  "LAB_TECH",
  "PHARMACIST",
  "RADIOLOGIST",
  "THERAPIST",
  "RECEPTIONIST",
  "SECURITY_OFFICER",
  "SECURITY_ADMIN",
  "HR_MANAGER",
  "PAYROLL_OFFICER",
  "COMMUNITY_HEALTH_WORKER",
  "PATIENT",
];

export function useTrainingTracker({ searchParams, setSearchParams, user, isGlobal }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [q, setQ] = useState(searchParams.get("q") || "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");
  const [roleFilter, setRoleFilter] = useState(searchParams.get("role") || "");
  const [hospitalFilter, setHospitalFilter] = useState(searchParams.get("hospital") || "");
  const [overdueOnly, setOverdueOnly] = useState(searchParams.get("overdue") === "1");
  const [traineeQuery, setTraineeQuery] = useState("");
  const [traineeResults, setTraineeResults] = useState([]);
  const [traineeSelection, setTraineeSelection] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [traineeRole, setTraineeRole] = useState("DOCTOR");
  const [trainerNotes, setTrainerNotes] = useState("");

  const selectedTrainee = useMemo(
    () => traineeResults.find((w) => String(w._id) === String(traineeSelection)) || null,
    [traineeResults, traineeSelection]
  );

  const displayedItems = useMemo(() => {
    if (!overdueOnly) return items;
    const now = Date.now();
    return items.filter((row) => {
      if (row.status === "NOT_STARTED" && row.createdAt) {
        return now - new Date(row.createdAt).getTime() >= 3 * 24 * 60 * 60 * 1000;
      }
      if (row.status === "IN_PROGRESS" && row.updatedAt) {
        return now - new Date(row.updatedAt).getTime() >= 7 * 24 * 60 * 60 * 1000;
      }
      return false;
    });
  }, [items, overdueOnly]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const data = await listTrainingTrackers({
        q,
        status: statusFilter || undefined,
        role: roleFilter || undefined,
        hospital: hospitalFilter || undefined,
        limit: 120,
      });
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      setMessage(err?.message || "Failed to load training trackers.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [hospitalFilter, q, roleFilter, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadItems();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadItems]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (statusFilter) next.set("status", statusFilter);
    if (roleFilter) next.set("role", roleFilter);
    if (hospitalFilter) next.set("hospital", hospitalFilter);
    if (overdueOnly) next.set("overdue", "1");
    setSearchParams(next, { replace: true });
  }, [q, statusFilter, roleFilter, hospitalFilter, overdueOnly, setSearchParams]);

  useEffect(() => {
    const needle = String(traineeQuery || "").trim();
    if (needle.length < 2) {
      setTraineeResults([]);
      return;
    }
    let mounted = true;
    apiFetch(`/api/search?q=${encodeURIComponent(needle)}&limit=10`)
      .then((data) => {
        if (!mounted) return;
        const workers = Array.isArray(data?.workers) ? data.workers : [];
        setTraineeResults(workers);
      })
      .catch(() => {
        if (mounted) setTraineeResults([]);
      });
    return () => {
      mounted = false;
    };
  }, [traineeQuery]);

  const handleCreate = useCallback(async () => {
    const payload = {
      traineeRole: selectedTrainee?.role || traineeRole,
      traineeUserId: selectedTrainee?._id || undefined,
      traineeName: selectedTrainee?.name || manualName,
      traineeEmail: selectedTrainee?.email || manualEmail,
      trainerNotes,
      hospitalId: isGlobal ? hospitalFilter || selectedTrainee?.hospital || user?.hospital : user?.hospital,
    };

    if (!payload.traineeRole || !payload.traineeName) {
      setMessage("Select/search a trainee or enter trainee name and role.");
      return false;
    }
    if (isGlobal && !payload.hospitalId) {
      setMessage("For global roles, provide hospital id in filter first.");
      return false;
    }

    setBusy(true);
    setMessage("");
    try {
      await upsertTrainingTracker(payload);
      setManualName("");
      setManualEmail("");
      setTraineeQuery("");
      setTraineeSelection("");
      setTrainerNotes("");
      await loadItems();
      setMessage("Training tracker saved.");
      return true;
    } catch (err) {
      setMessage(err?.message || "Failed to save tracker.");
      return false;
    } finally {
      setBusy(false);
    }
  }, [hospitalFilter, isGlobal, loadItems, manualEmail, manualName, selectedTrainee, traineeQuery, traineeRole, trainerNotes, user?.hospital]);

  const toggleDay = useCallback(async (tracker, dayRow) => {
    setBusy(true);
    setMessage("");
    try {
      await updateTrainingDay(tracker._id, dayRow.day, { completed: !dayRow.completed });
      await loadItems();
      return true;
    } catch (err) {
      setMessage(err?.message || "Failed to update day status.");
      return false;
    } finally {
      setBusy(false);
    }
  }, [loadItems]);

  const exportCsv = useCallback(() => {
    const esc = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const header = [
      "Trainee Name",
      "Trainee Email",
      "Role",
      "Status",
      "Progress Percent",
      "Completed Days",
      "Updated At",
    ];
    const rows = displayedItems.map((row) => {
      const completedDays = (row.days || [])
        .filter((d) => d?.completed)
        .map((d) => `D${d.day}`)
        .join(" ");
      return [
        row.traineeName,
        row.traineeEmail || "",
        row.traineeRole,
        row.status,
        Number(row.progressPercent || 0),
        completedDays,
        row.updatedAt ? new Date(row.updatedAt).toISOString() : "",
      ];
    });
    const csv = [header, ...rows].map((cols) => cols.map(esc).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `training-tracker-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [displayedItems]);

  return {
    TRACKABLE_ROLES,
    items,
    loading,
    busy,
    message,
    q,
    setQ,
    statusFilter,
    setStatusFilter,
    roleFilter,
    setRoleFilter,
    hospitalFilter,
    setHospitalFilter,
    overdueOnly,
    setOverdueOnly,
    traineeQuery,
    setTraineeQuery,
    traineeResults,
    traineeSelection,
    setTraineeSelection,
    manualName,
    setManualName,
    manualEmail,
    setManualEmail,
    traineeRole,
    setTraineeRole,
    trainerNotes,
    setTrainerNotes,
    selectedTrainee,
    displayedItems,
    loadItems,
    handleCreate,
    toggleDay,
    exportCsv,
  };
}

export default useTrainingTracker;
