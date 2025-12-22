import React, { useEffect, useState } from "react";
import { apiFetch } from "../../utils/apiFetch";
import WorkflowTimeline from "../workflow/WorkflowTimeline";

/**
 * PHARMACY DASHBOARD — WORKFLOW + SHA ENFORCED
 * Backend is the single source of truth
 */

export default function PharmacyDashboard() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    loadQueue();
  }, []);

  async function loadQueue() {
    setLoading(true);
    setMsg("");

    try {
      const res = await apiFetch("/api/encounters?stage=PHARMACY");
      if (!res.ok) throw new Error();

      setQueue(await res.json());
    } catch {
      setMsg("Failed to load pharmacy queue");
    } finally {
      setLoading(false);
    }
  }

  async function dispense(encounterId, prescriptionId) {
    setMsg("");

    try {
      const res = await apiFetch("/api/pharmacy/dispense", {
        method: "POST",
        body: JSON.stringify({
          encounterId,
          prescriptionId,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Dispense failed");
      }

      await loadQueue();
    } catch (e) {
      setMsg(e.message);
    }
  }

  return (
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
  );
}
