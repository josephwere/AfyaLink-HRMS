import React, { useEffect, useState } from "react";
import { apiFetch } from "../../utils/apiFetch";
import WorkflowBadge from "./WorkflowBadge";
import SLABadge from "./SLABadge";


/**
 * WORKFLOW TIMELINE — READ ONLY
 * 🔒 Backend is the single source of truth
 * 🎨 Visuals via shared WorkflowBadge
 */
export default function WorkflowTimeline({ encounterId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!encounterId) return;
    loadTimeline();
  }, [encounterId]);

  async function loadTimeline() {
    setLoading(true);
    setErr("");

    try {
      const res = await apiFetch(
        `/api/workflows/${encounterId}/timeline`
      );
      if (!res.ok) throw new Error("Failed to load workflow");

      setData(await res.json());
    } catch (e) {
      setErr(e.message || "Failed to load workflow timeline");
    } finally {
      setLoading(false);
    }
  }

  if (!encounterId) return null;

  if (loading) {
    return <div className="card">Loading workflow…</div>;
  }

  if (err) {
    return (
      <div className="card" style={{ color: "red" }}>
        {err}
      </div>
    );
  }

  const { workflow, audit } = data;

  return (
    <div className="card premium-card">
      <h3 style={{ marginBottom: 12 }}>Workflow Timeline</h3>

      {/* ================= CURRENT STATE ================= */}
      <div style={{ marginBottom: 16 }}>
        <strong>Current State:</strong>{" "}
        <WorkflowBadge state={workflow.state} />
      </div>

      {/* ================= ALLOWED ACTIONS ================= */}
      <div style={{ marginBottom: 20 }}>
        <strong>Allowed Actions:</strong>
        <div style={{ marginTop: 8 }}>
          {workflow.allowedTransitions.length === 0 ? (
            <em style={{ opacity: 0.7 }}>No actions allowed</em>
          ) : (
            workflow.allowedTransitions.map((a) => (
              <WorkflowBadge key={a} state={a} />
            ))
          )}
        </div>
      </div>

      {/* ================= SLA ================= */}
{data.sla?.length > 0 && (
  <>
    <h4>SLA Timers</h4>
    {data.sla.map((s) => (
      <SLABadge key={s.name} sla={s} />
    ))}
  </>
)}

      {/* ================= WORKFLOW HISTORY ================= */}
      <h4>Workflow History</h4>

      {workflow.history.length === 0 ? (
        <em>No workflow transitions recorded.</em>
      ) : (
        <ul className="timeline">
          {workflow.history.map((h, idx) => (
            <li
              key={idx}
              className="timeline-item"
              style={{ marginBottom: 12 }}
            >
              <WorkflowBadge state={h.state} />
              <div style={{ fontSize: 13, opacity: 0.8 }}>
                {new Date(h.at).toLocaleString()}
              </div>
              <div style={{ fontSize: 13 }}>
                By: {h.by || "system"}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* ================= AUDIT LOG ================= */}
      {audit?.length > 0 && (
        <>
          <h4 style={{ marginTop: 24 }}>Audit Trail</h4>
          <ul className="timeline audit">
            {audit.map((a) => (
              <li
                key={a.id}
                className="timeline-item"
                style={{ marginBottom: 12 }}
              >
                <strong>{a.action}</strong>
                <div style={{ fontSize: 13, opacity: 0.8 }}>
                  {new Date(a.at).toLocaleString()}
                </div>
                <div style={{ fontSize: 13 }}>
                  Role: {a.actorRole}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
