import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../utils/auth";
import apiFetch from "../../utils/apiFetch";
import {
  listTrainingTrackers,
  updateTrainingDay,
  upsertTrainingTracker,
} from "../../services/trainingTrackerApi";

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

function statusClass(status) {
  if (status === "COMPLETED") return "pill success";
  if (status === "IN_PROGRESS") return "pill warning";
  return "pill";
}

export default function TrainingTracker() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const actorRole = String(user?.actualRole || user?.role || "").toUpperCase();
  const isGlobal = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(actorRole);

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

  const loadItems = async () => {
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
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadItems();
    }, 250);
    return () => clearTimeout(timer);
  }, [q, statusFilter, roleFilter, hospitalFilter]);

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

  const handleCreate = async () => {
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
      return;
    }
    if (isGlobal && !payload.hospitalId) {
      setMessage("For global roles, provide hospital id in filter first.");
      return;
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
    } catch (err) {
      setMessage(err?.message || "Failed to save tracker.");
    } finally {
      setBusy(false);
    }
  };

  const toggleDay = async (tracker, dayRow) => {
    setBusy(true);
    setMessage("");
    try {
      await updateTrainingDay(tracker._id, dayRow.day, { completed: !dayRow.completed });
      await loadItems();
    } catch (err) {
      setMessage(err?.message || "Failed to update day status.");
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
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
    const csv = [header, ...rows]
      .map((cols) => cols.map(esc).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `training-tracker-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page">
      <div className="card">
        <h2>Training Tracker</h2>
        <p className="muted">
          Track day-by-day onboarding completion for all AfyaLink roles and keep trainer evidence in one place.
        </p>
      </div>

      <div className="card">
        <h3>Filters</h3>
        <div className="form-row">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search trainee name/email"
            data-ai-label="Tracker Search"
            data-ai-aliases="search trainee|filter search|training tracker search"
            data-ai-intent="filter"
            data-ai-priority="low"
          />
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="">All roles</option>
            {TRACKABLE_ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All status</option>
            <option value="NOT_STARTED">Not started</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="COMPLETED">Completed</option>
          </select>
          {isGlobal && (
            <input
              value={hospitalFilter}
              onChange={(e) => setHospitalFilter(e.target.value)}
              placeholder="Hospital ID (global scope)"
              data-ai-label="Hospital Filter"
              data-ai-aliases="training hospital filter|global hospital scope"
              data-ai-intent="filter"
              data-ai-priority="low"
            />
          )}
          <button type="button" className="btn" onClick={loadItems} disabled={loading}>
            Refresh
          </button>
          <button type="button" className="btn" onClick={exportCsv} disabled={loading || !displayedItems.length}>
            Export CSV
          </button>
          <button
            type="button"
            className={`btn ${overdueOnly ? "primary" : ""}`}
            onClick={() => setOverdueOnly((v) => !v)}
          >
            {overdueOnly ? "Overdue: ON" : "Overdue: OFF"}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setStatusFilter("");
              setOverdueOnly(true);
            }}
          >
            Show Overdue Only
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setQ("");
              setRoleFilter("");
              setStatusFilter("");
              setOverdueOnly(false);
            }}
          >
            Clear Filters
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Create / Update Trainee Plan</h3>
        <div className="form-grid">
          <label>
            Search registered worker
            <input
              value={traineeQuery}
              onChange={(e) => setTraineeQuery(e.target.value)}
              placeholder="Type name/email (2+ chars)"
              data-ai-label="Search Registered Worker"
              data-ai-aliases="trainee lookup|worker search|find trainee"
              data-ai-widget="worker-search"
            />
          </label>
          <label>
            Search results
            <select
              value={traineeSelection}
              onChange={(e) => {
                setTraineeSelection(e.target.value);
                const picked = traineeResults.find((w) => String(w._id) === e.target.value);
                if (picked?.role) setTraineeRole(picked.role);
              }}
              data-ai-label="Search Results"
              data-ai-aliases="selected trainee|worker result|choose trainee"
              data-ai-widget="worker-picker"
            >
              <option value="">Manual entry</option>
              {traineeResults.map((w) => (
                <option key={w._id} value={w._id}>
                  {w.name} ({w.role}) {w.email ? `- ${w.email}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Trainee role
            <select
              value={traineeRole}
              onChange={(e) => setTraineeRole(e.target.value)}
              data-ai-label="Trainee Role"
              data-ai-aliases="worker role|onboarding role|staff role"
            >
              {TRACKABLE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
          <label>
            Manual trainee name
            <input
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              placeholder="Use if not selecting a worker above"
              data-ai-label="Manual Trainee Name"
              data-ai-aliases="trainee name|worker name|staff name"
            />
          </label>
          <label>
            Manual trainee email
            <input
              value={manualEmail}
              onChange={(e) => setManualEmail(e.target.value)}
              placeholder="Optional"
              data-ai-label="Manual Trainee Email"
              data-ai-aliases="trainee email|worker email"
            />
          </label>
          <label>
            Trainer notes
            <textarea
              rows={3}
              value={trainerNotes}
              onChange={(e) => setTrainerNotes(e.target.value)}
              placeholder="Initial training context and reminders"
              data-ai-label="Trainer Notes"
              data-ai-aliases="training notes|onboarding notes|trainer context"
            />
          </label>
        </div>
        <div className="form-actions">
          <button type="button" className="btn primary" onClick={handleCreate} disabled={busy}>
            Save Trainee Plan
          </button>
        </div>
        {message ? <p className="muted">{message}</p> : null}
      </div>

      <div className="card">
        <h3>Weekly Progress</h3>
        {loading ? <p>Loading...</p> : null}
        {!loading && (
          <div className="table-wrap">
            <table className="table lite">
              <thead>
                <tr>
                  <th>Trainee</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Day 1-7</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {displayedItems.map((row) => (
                  <tr key={row._id}>
                    <td>
                      <strong>{row.traineeName}</strong>
                      <br />
                      <span className="muted">{row.traineeEmail || "-"}</span>
                    </td>
                    <td>{row.traineeRole}</td>
                    <td>
                      <span className={statusClass(row.status)}>{row.status}</span>
                    </td>
                    <td>{Number(row.progressPercent || 0)}%</td>
                    <td>
                      <div className="row-actions">
                        {(row.days || []).map((d) => (
                          <button
                            key={`${row._id}-${d.day}`}
                            type="button"
                            className={`btn-tiny ${d.completed ? "ok" : ""}`}
                            title={d.title || `Day ${d.day}`}
                            onClick={() => toggleDay(row, d)}
                            disabled={busy}
                          >
                            D{d.day}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td>{new Date(row.updatedAt).toLocaleString()}</td>
                  </tr>
                ))}
                {displayedItems.length === 0 && (
                  <tr>
                    <td colSpan={6}>No training trackers found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
