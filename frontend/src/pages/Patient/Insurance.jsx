import React from "react";
import ModuleWorkspace from "../../components/ModuleWorkspace";

export default function PatientInsurance() {
  return (
    <ModuleWorkspace
      title="Insurance"
      subtitle="Coverage details, authorization status and claim references."
      actions={[{ label: "View Coverage", variant: "primary" }, { label: "Claims History" }]}
      panels={[
        { title: "Coverage", body: "Policy and coverage summary." },
        { title: "Authorizations", body: "Encounter authorization status." },
        { title: "Claims", body: "Claim outcomes and references." },
      ]}
    />
  );
}
