import React from "react";
import WorkflowTimeline from "../../components/workflow/WorkflowTimeline";
import WorkflowBadge from "../../components/workflow/WorkflowBadge";
import useAdminInsuranceActions from "../../hooks/useAdminInsuranceActions";

/**
 * ADMIN INSURANCE ACTIONS
 * 🔒 Admin only
 * 🧾 Justification required
 * 🔁 Workflow authoritative
 */
export default function AdminInsuranceActions({ encounter }) {
  if (!encounter?.workflow) return null;
  const {
    justification,
    setJustification,
    loading,
    msg,
    canApprove,
    canReject,
    approve,
    reject,
  } = useAdminInsuranceActions(encounter);

  return (
    <div className="card premium-card">
      <h3>🛡 Insurance Admin Override</h3>

      <div style={{ marginBottom: 12 }}>
        <strong>Current Status:</strong>{" "}
        <WorkflowBadge state={encounter.workflow.state} />
      </div>

      {msg && (
        <div style={{ marginBottom: 12, color: "#b91c1c" }}>
          {msg}
        </div>
      )}

      <textarea
        className="full-width"
        placeholder="Enter justification (required for audit)"
        value={justification}
        onChange={(e) => setJustification(e.target.value)}
        rows={4}
        style={{ marginBottom: 12 }}
        disabled={loading}
      />

      <div className="actions-row gap-12">
        <button
          type="button"
          onClick={approve}
          disabled={!canApprove || loading}
          style={{ background: "#16a34a", color: "white" }}
        >
          Approve Insurance
        </button>

        <button
          type="button"
          onClick={reject}
          disabled={!canReject || loading}
          style={{ background: "#dc2626", color: "white" }}
        >
          Reject Insurance
        </button>
      </div>

      <div style={{ marginTop: 16 }}>
        <WorkflowTimeline encounterId={encounter._id} />
      </div>
    </div>
  );
}
