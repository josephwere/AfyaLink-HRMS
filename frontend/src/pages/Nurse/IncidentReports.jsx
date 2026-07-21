import React from "react";
import ModuleWorkspace from "../../components/ModuleWorkspace";
import { useNurseDashboard } from "../../hooks/useNurseDashboard";

export default function IncidentReports() {
  const { openEscalationCount, pendingTransferCount, loading, transferError } = useNurseDashboard();

  return (
    <div className="dashboard">
      <ModuleWorkspace
        title="Incident Reports"
        subtitle="Create, track and escalate safety incidents from nursing operations."
        actions={[
          { label: "New Incident", variant: "primary", path: "/nurse/incidents#new" },
          { label: "Open Incident Queue", path: "/nurse/incidents#queue" },
        ]}
        kpis={[
          { title: "Open Escalations", value: openEscalationCount, subtitle: loading ? "Refreshing" : transferError || "Ward escalation queue" },
          { title: "Pending Transfers", value: pendingTransferCount, subtitle: "Transfer handoff review" },
        ]}
        panels={[
          { title: "Quick Form", body: "Capture severity, event details and affected patient." },
          { title: "Escalations", body: `High-risk cases routed to security/admin${openEscalationCount ? ` (${openEscalationCount} open)` : ""}.` },
          { title: "History", body: "Review previously filed incidents and status." },
        ]}
      />
    </div>
  );
}
