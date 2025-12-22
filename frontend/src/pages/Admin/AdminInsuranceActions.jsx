import React, { useState } from "react";
import { apiFetch } from "../../utils/apiFetch";
import WorkflowTimeline from "../../components/workflow/WorkflowTimeline";
import WorkflowBadge from "../../components/workflow/WorkflowBadge";

/**
 * ADMIN INSURANCE ACTIONS
 * 🔒 Admin only
 * 🧾 Justification required
 * 🔁 Workflow authoritative
 */
export default function AdminInsuranceActions({ encounter }) {
  const [justification, setJustification] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  if (!encounter?.workflow) return null;

  const allowed = encounter.workflow.allowedTransitions || [];

  const canApprove = allowed.includes("INSURANCE_APPROVED");
  const canReject = allowed.includes("INSURANCE_REJECTED");

  async function approve() {
    if (!justification.trim()) {
      setMsg("Justification is required");
      return;
    }

    setLoading(true);
    setMsg("");

    try {
      const res = await apiFetch("/api/insurance/admin/approve", {
        method: "POST",
        body: {
          encounterId: encounter._id,
          justification,
        },
      });

      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Approval failed");

      setMsg("✅ Insurance approved successfully");
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function reject() {
    if (!justification.trim()) {
      setMsg("Justification is required");
      return;
    }

    setLoading(true);
    setMsg("");

    try {
      const res = await apiFetch("/api/insurance/admin/reject", {
        method: "POST",
        body: {
          encounterId: encounter._id,
          justification,
        },
      });

      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Rejection failed");

      setMsg("❌ Insurance rejected");
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card premium-card">
      <h3>🛡 Insurance Admin Override</h3>

      {/* =========================
          CURRENT WORKFLOW STATE
      ========================== */}
      <div style={{ marginBottom: 12 }}>
        <strong>Current Status:</strong>{" "}
        <WorkflowBadge state={encounter.workflow.state} />
      </div>

      {msg && (
        <div style={{ marginBottom: 12, color: "#b91c1c" }}>
          {msg}
        </div>
      )}

      {/* =========================
          JUSTIFICATION
      ========================== */}
      <textarea
        placeholder="Enter justification (required for audit)"
        value={justification}
        onChange={(e) => setJustification(e.target.value)}
        rows={4}
        style={{ width: "100%", marginBottom: 12 }}
        disabled={loading}
      />

      {/* =========================
          ACTION BUTTONS
      ========================== */}
      <div style={{ display: "flex", gap: 12 }}>
        <button
          onClick={approve}
          disabled={!canApprove || loading}
          style={{ background: "#16a34a", color: "white" }}
        >
          Approve Insurance
        </button>

        <button
          onClick={reject}
          disabled={!canReject || loading}
          style={{ background: "#dc2626", color: "white" }}
        >
          Reject Insurance
        </button>
      </div>

      {/* =========================
          WORKFLOW CONTEXT (ALWAYS)
      ========================== */}
      <div style={{ marginTop: 16 }}>
        <WorkflowTimeline encounterId={encounter._id} />
      </div>
    </div>
  );
}
