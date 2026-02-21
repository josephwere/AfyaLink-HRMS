import React from "react";

export default function SLABadge({ sla }) {
  if (!sla) return null;

  const mins = Math.floor(sla.elapsedMs / 60000);
  const breached = sla.breached;

  return (
    <div
      style={{
        padding: "6px 10px",
        borderRadius: 8,
        background: breached ? "#fee2e2" : "#ecfeff",
        color: breached ? "#b91c1c" : "#0369a1",
        fontSize: 13,
        fontWeight: 600,
        marginBottom: 6,
      }}
    >
      ⏱ {sla.name}: {mins} min
      {breached && " ⚠️ SLA BREACHED"}
    </div>
  );
}
