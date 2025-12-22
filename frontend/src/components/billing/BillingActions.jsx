import React, { useState } from "react";
import { apiFetch } from "../../utils/apiFetch";
import WorkflowTimeline from "../workflow/WorkflowTimeline";

/**
 * BILLING ACTIONS — INSURANCE GATE
 *
 * - Provider agnostic (SHA today, others tomorrow)
 * - No duplicate authorization
 * - Workflow-controlled
 */

export default function BillingActions({ encounter }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  if (!encounter) return null;

  const workflow = encounter.workflow || {};

  const canPreauth =
    workflow.allowedTransitions?.includes("INSURANCE_PREAUTHORIZED");

  const alreadyApproved =
    workflow.state === "INSURANCE_APPROVED";

  async function requestShaPreauth() {
    if (!canPreauth || alreadyApproved) return;

    setLoading(true);
    setMsg("");

    try {
      const res = await apiFetch(
        "/api/insurance/sha/preauth",
        {
          method: "POST",
          body: JSON.stringify({
            encounterId: encounter._id,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "SHA pre-auth failed");

      setMsg("SHA pre-authorization submitted successfully.");
    } catch (err) {
      setMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card sub-card">
      <h4>Insurance Authorization</h4>

      {msg && (
        <div style={{ color: msg.includes("failed") ? "red" : "green" }}>
          {msg}
        </div>
      )}

      <button
        className="button gradient-blue"
        disabled={loading || !canPreauth || alreadyApproved}
        onClick={requestShaPreauth}
      >
        {alreadyApproved
          ? "Insurance Approved"
          : loading
          ? "Submitting..."
          : "Request SHA Pre-Authorization"}
      </button>

      <div style={{ marginTop: 12 }}>
        <WorkflowTimeline encounterId={encounter._id} />
      </div>
    </div>
  );
}
