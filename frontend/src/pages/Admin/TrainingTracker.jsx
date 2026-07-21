import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../utils/auth";
import { useTrainingTracker } from "../../hooks/useTrainingTracker";

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
  const {
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
  } = useTrainingTracker({ searchParams, setSearchParams, user, isGlobal });

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
