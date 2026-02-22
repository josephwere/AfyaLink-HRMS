import React from "react";
import ModuleWorkspace from "../../components/ModuleWorkspace";

export default function IncidentReports() {
  return (
    <ModuleWorkspace
      title="Incident Reports"
      subtitle="Create, track and escalate safety incidents from nursing operations."
      actions={[
        { label: "New Incident", variant: "primary", path: "/nurse/incidents#new" },
        { label: "Open Incident Queue", path: "/nurse/incidents#queue" },
      ]}
      panels={[
        { title: "Quick Form", body: "Capture severity, event details and affected patient." },
        { title: "Escalations", body: "High-risk cases routed to security/admin." },
        { title: "History", body: "Review previously filed incidents and status." },
      ]}
    />
  );
}
