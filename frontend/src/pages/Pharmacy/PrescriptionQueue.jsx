import React from "react";
import ModuleWorkspace from "../../components/ModuleWorkspace";

export default function PrescriptionQueue() {
  return (
    <ModuleWorkspace
      title="Prescription Queue"
      subtitle="Pending and active prescriptions awaiting dispensing workflow."
      actions={[{ label: "Open Queue", variant: "primary" }, { label: "Verify Interactions" }]}
      panels={[
        { title: "Pending", body: "Newly created prescriptions awaiting validation." },
        { title: "In Progress", body: "Prescriptions currently being dispensed." },
        { title: "Completed", body: "Dispensed and closed prescriptions." },
      ]}
    />
  );
}
