import React, { useEffect, useState } from "react";
import { apiFetch } from "../../utils/apiFetch";
import WorkflowTimeline from "../../components/workflow/WorkflowTimeline";
import WorkflowBadge from "../../components/workflow/WorkflowBadge";
import { listTransfers } from "../../services/transferApi";

/**
 * LAB DASHBOARD — WORKFLOW ENFORCED
 * 🔒 Backend is the single source of truth
 */

export default function LabDashboard() {
  const [encounters, setEncounters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

  useEffect(() => {
    loadLabQueue();
    listTransfers({ limit: 6, scope: "facility" })
      .then((res) => {
        const items = Array.isArray(res?.items) ? res.items : [];
        setTransfers(items);
        setTransferError("");
      })
      .catch((err) => {
        setTransfers([]);
        setTransferError(err?.message || "Failed to load transfers.");
      });
  }, []);

  async function loadLabQueue() {
    setLoading(true);
    setMsg("");

    try {
      const data = await apiFetch("/api/encounters?stage=LAB");
      setEncounters(data || []);
    } catch {
      setMsg("Failed to load lab queue");
    } finally {
      setLoading(false);
    }
  }

  async function completeLab(encounterId) {
    setMsg("");

    try {
      await apiFetch("/api/labs/complete", {
        method: "POST",
        body: { encounterId },
      });

      await loadLabQueue();
    } catch (e) {
      setMsg(e.message);
    }
  }

  return (
    <div className="dashboard">
      <div className="card premium-card">
        <h2>Lab Queue</h2>

      {msg && (
        <div style={{ color: "red", marginBottom: 12 }}>{msg}</div>
      )}

      {loading ? (
        <div>Loading…</div>
      ) : encounters.length ? (
        encounters.map((e) => {
          const canComplete =
            e.workflow?.allowedTransitions?.includes("LAB_COMPLETED");

          return (
            <div key={e._id} className="card sub-card">
              {/* ================= HEADER ================= */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <strong>{e.patient?.name}</strong>
                <WorkflowBadge state={e.workflow?.state} />
              </div>

              {/* ================= ACTION ================= */}
              <button
                type="button"
                disabled={!canComplete}
                onClick={() => completeLab(e._id)}
              >
                Complete Lab
              </button>

              {/* ================= WORKFLOW (NEVER HIDDEN) ================= */}
              <WorkflowTimeline encounterId={e._id} />
            </div>
          );
        })
      ) : (
        <div>No lab work pending</div>
      )}
      </div>

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <div className="card-header-actions">
            <div>
              <h3>Transfer Continuity</h3>
              <p className="muted">Recent transfers and handoff status.</p>
            </div>
            <div className="action-pill">Pending: {transfers.filter((t) => t.status === "Pending").length}</div>
          </div>
          {transferError ? <div className="muted">{transferError}</div> : null}
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="doctor-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Route</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t) => (
                  <tr key={t._id}>
                    <td>{t?.patient?.firstName || ""} {t?.patient?.lastName || ""}</td>
                    <td>{t?.fromHospital?.name || t?.fromHospital?.code || "—"} → {t?.toHospital?.name || t?.toHospital?.code || "—"}</td>
                    <td>{t.status}</td>
                  </tr>
                ))}
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="muted">No transfers yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card doctor-alerts-card">
          <h3>Continuity Actions</h3>
          <div className="alert-stack">
            <div className="alert-item">Attach pending results before transfer completion.</div>
            <div className="alert-item">Flag critical labs for receiving team.</div>
            <div className="alert-item">Coordinate sample handoff when needed.</div>
          </div>
        </div>
      </section>
    </div>
  );
}
