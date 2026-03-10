import React, { useEffect, useState } from "react";
import { apiFetch } from "../../utils/apiFetch";
import WorkflowTimeline from "../../components/workflow/WorkflowTimeline";
import { listTransfers } from "../../services/transferApi";

/**
 * LAB DASHBOARD — WORKFLOW ENFORCED
 * Backend is the ONLY authority
 */

export default function LabDashboard() {
  const [encounters, setEncounters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

  useEffect(() => {
    loadLabQueue();
    loadTransfers();
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
    } catch (err) {
      setMsg(err.message);
    }
  }

  async function loadTransfers() {
    try {
      const data = await listTransfers({ limit: 6, scope: "facility" });
      const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      setTransfers(items);
      setTransferError("");
    } catch (err) {
      setTransfers([]);
      setTransferError(err?.message || "Unable to load transfers.");
    }
  }

  return (
    <div className="card premium-card">
      <h2>Lab Queue</h2>

      {msg && (
        <div style={{ color: "red", marginBottom: 12 }}>{msg}</div>
      )}

      {loading ? (
        <div>Loading...</div>
      ) : encounters.length ? (
        <table className="table premium-table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>Tests</th>
              <th>Status</th>
              <th>Action</th>
              <th>Workflow</th>
            </tr>
          </thead>
          <tbody>
            {encounters.map((e) => {
              const canCompleteLab =
                e.workflow?.allowedTransitions?.includes("LAB_COMPLETED");

              return (
                <tr key={e._id}>
                  <td>{e.patient?.name}</td>
                  <td>{e.labOrders?.length || 0}</td>
                  <td>{e.workflow?.state}</td>

                  <td>
                    <button
                      type="button"
                      className="button gradient-green"
                      disabled={!canCompleteLab}
                      onClick={() => completeLab(e._id)}
                    >
                      Complete Lab
                    </button>
                  </td>

                  <td style={{ minWidth: 280 }}>
                    <WorkflowTimeline encounterId={e._id} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <div>No lab work pending</div>
      )}

      <div style={{ marginTop: 24 }}>
        <div className="card">
          <div className="card-header-actions">
            <div>
              <h3>Transfer Continuity</h3>
              <p className="muted">Recent transfers and handoff status.</p>
            </div>
            <div className="action-pill">
              Pending: {transfers.filter((t) => t.status === "Pending").length}
            </div>
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
      </div>
    </div>
  );
}
