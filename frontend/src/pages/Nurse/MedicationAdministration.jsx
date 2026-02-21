import React from "react";
import ModuleWorkspace from "../../components/ModuleWorkspace";

export default function MedicationAdministration() {
  return (
    <ModuleWorkspace
      title="Medication Administration"
      subtitle="Due medications, verification checks and administration logs."
      actions={[{ label: "Open MAR", variant: "primary" }, { label: "Drug Interaction Check" }]}
      panels={[
        { title: "Due Medications", body: "Upcoming medication tasks by time." },
        { title: "Verification", body: "Patient, dose and route verification controls." },
        { title: "Administration Log", body: "Time-stamped medication administration records." },
      ]}
    />
  );
}
