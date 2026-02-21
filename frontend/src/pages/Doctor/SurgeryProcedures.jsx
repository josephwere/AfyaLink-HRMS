import React from "react";
import DoctorModuleLayout from "./DoctorModuleLayout";

export default function SurgeryProcedures() {
  return (
    <DoctorModuleLayout
      title="Surgery & Procedures"
      subtitle="Pre-op to post-op documentation, checklists, outcomes and complications."
      actions={[
        { label: "Open Surgery Calendar", variant: "primary" },
        { label: "Log Procedure" },
      ]}
      panels={[
        { title: "Surgery Calendar", body: "Procedure schedule by theater and team." },
        { title: "Pre-op Checklist", body: "Consent, readiness and anesthetic checks." },
        { title: "Procedure Notes", body: "Structured operative documentation." },
        { title: "Outcome Tracking", body: "Post-op outcomes and complication reports." },
      ]}
    />
  );
}
