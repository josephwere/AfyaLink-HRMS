import React from "react";
import ModuleWorkspace from "../../components/ModuleWorkspace";

export default function PatientLabResults() {
  return (
    <ModuleWorkspace
      title="Lab Results"
      subtitle="View completed labs, flagged values and trend history."
      actions={[{ label: "View Results", variant: "primary" }, { label: "Download PDF" }]}
      panels={[
        { title: "Completed", body: "Completed test result archive." },
        { title: "Flagged", body: "Abnormal values requiring review." },
        { title: "Trends", body: "Historic result trends over time." },
      ]}
    />
  );
}
