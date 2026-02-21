import React from "react";
import ModuleWorkspace from "../../components/ModuleWorkspace";

export default function QualityControl() {
  return (
    <ModuleWorkspace
      title="Quality Control"
      subtitle="QC runs, deviations and corrective action tracking."
      actions={[{ label: "Run QC", variant: "primary" }, { label: "Deviation Log" }]}
      panels={[
        { title: "QC Runs", body: "Daily and batch QC checkpoints." },
        { title: "Deviations", body: "Abnormal QC outcomes and escalation." },
        { title: "Corrective Actions", body: "Action ownership and closure tracking." },
      ]}
    />
  );
}
