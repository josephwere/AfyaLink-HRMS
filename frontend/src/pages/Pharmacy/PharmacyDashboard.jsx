import React, { useEffect, useState } from "react";
import { apiFetch } from "../../utils/apiFetch";
import WorkflowTimeline from "../../components/workflow/WorkflowTimeline";
import { listTransfers } from "../../services/transferApi";

/**
 * PHARMACY DASHBOARD — WORKFLOW + SHA ENFORCED
 * Backend is the single source of truth
 */

export default function PharmacyDashboard() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

  useEffect(() => {
    loadQueue();
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

  async function loadQueue() {
    setLoading(true);
    setMsg("");

    try {
      const data = await apiFetch("/api/encounters?stage=PHARMACY");
      const rows = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
        ? data.items
        : [];
      setQueue(rows);
    } catch {
      setMsg("Failed to load pharmacy queue");
      setQueue([]);
    } finally {
      setLoading(false);
    }
  }

  async function dispense(encounterId, prescriptionId) {
    setMsg("");

    try {
      await apiFetch("/api/pharmacy/dispense", {
        method: "POST",
        body: {
          encounterId,
          prescriptionId,
        },
      });

      await loadQueue();
    } catch (e) {
      setMsg(e.message);
    }
  }

  return (
    <div className="dashboard">
      <div className="card premium-card">
        <h2>Pharmacy Queue</h2>

      {msg && <div style={{ color: "red", marginBottom: 12 }}>{msg}</div>}

      {loading ? (
        <div>Loading…</div>
      ) : queue.length ? (
        queue.map((e) => {
          const canDispense =
            e.workflow?.allowedTransitions?.includes("DISPENSED");

          return (
            <div key={e._id} className="card sub-card">
              <strong>{e.patient?.name}</strong>

              <button
                type="button"
                disabled={!canDispense}
                onClick={() =>
                  dispense(e._id, e.prescriptions?.[0])
                }
              >
                Dispense
              </button>

              {/* 🔐 Timeline always visible */}
              <WorkflowTimeline encounterId={e._id} />
            </div>
          );
        })
      ) : (
        <div>No prescriptions pending</div>
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
            <div className="alert-item">Route prescriptions to nearest linked pharmacy.</div>
            <div className="alert-item">Attach substitution notes before transfer completion.</div>
            <div className="alert-item">Flag stock-outs for transfer handover summary.</div>
          </div>
        </div>
      </section>
    </div>
  );
}
