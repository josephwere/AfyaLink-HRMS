import React, { useEffect, useState } from "react";
import { apiFetch } from "../../utils/apiFetch";
import WorkflowTimeline from "../../components/workflow/WorkflowTimeline";

/**
 * LAB DASHBOARD — WORKFLOW ENFORCED
 * Backend is the ONLY authority
 */

export default function LabDashboard() {
  const [encounters, setEncounters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    loadLabQueue();
  }, []);

  async function loadLabQueue() {
    setLoading(true);
    setMsg("");

    try {
      const res = await apiFetch("/api/encounters?stage=LAB");
      if (!res.ok) throw new Error();

      setEncounters(await res.json());
    } catch {
      setMsg("Failed to load lab queue");
    } finally {
      setLoading(false);
    }
  }

  async function completeLab(encounterId) {
    setMsg("");

    try {
      const res = await apiFetch("/api/labs/complete", {
        method: "POST",
        body: { encounterId },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Lab completion failed");
      }

      await loadLabQueue();
    } catch (err) {
      setMsg(err.message);
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
    </div>
  );
}
