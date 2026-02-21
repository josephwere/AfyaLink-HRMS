import React from "react";
import ModuleWorkspace from "../../components/ModuleWorkspace";

export default function SafetyChecklist() {
  return (
    <ModuleWorkspace
      title="Safety Checklist"
      subtitle="Lab biosafety compliance checks and hazard readiness."
      actions={[{ label: "Start Checklist", variant: "primary" }, { label: "Report Hazard" }]}
      panels={[
        { title: "PPE", body: "Protective gear compliance checks." },
        { title: "Biohazard", body: "Containment and disposal controls." },
        { title: "Safety Audits", body: "Audit history and corrective tasks." },
      ]}
    />
  );
}
