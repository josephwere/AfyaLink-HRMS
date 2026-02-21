import React from "react";

/**
 * WORKFLOW STATE BADGE
 * 🔒 Read-only
 * 🎨 Visual authority
 */

const COLORS = {
  CREATED: "#64748b",
  INSURANCE_PENDING: "#f59e0b",
  INSURANCE_APPROVED: "#16a34a",
  INSURANCE_REJECTED: "#dc2626",

  TRIAGE_PENDING: "#0ea5e9",
  CONSULTATION: "#0ea5e9",

  LAB_PENDING: "#8b5cf6",
  LAB_COMPLETED: "#22c55e",

  PRESCRIPTION_READY: "#3b82f6",
  PHARMACY_PENDING: "#3b82f6",
  DISPENSED: "#16a34a",

  PAYMENT_PENDING: "#f97316",
  PAID: "#22c55e",

  COMPLETED: "#15803d",
  CANCELLED: "#6b7280",
};

export default function WorkflowBadge({ state }) {
  if (!state) return null;

  const bg = COLORS[state] || "#334155";

  return (
    <span
      style={{
        background: bg,
        color: "white",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: 0.4,
      }}
    >
      {state.replace(/_/g, " ")}
    </span>
  );
}
