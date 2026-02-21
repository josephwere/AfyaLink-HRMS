import React from "react";
import ModuleWorkspace from "../../components/ModuleWorkspace";

export default function PatientPrescriptions() {
  return (
    <ModuleWorkspace
      title="Prescriptions"
      subtitle="Active and historical prescriptions with refill and dosage guidance."
      actions={[{ label: "Active Prescriptions", variant: "primary" }, { label: "Refill Request" }]}
      panels={[
        { title: "Current Meds", body: "Currently active medications and dosage." },
        { title: "History", body: "Historical prescription records." },
        { title: "Refills", body: "Refill workflow and status tracking." },
      ]}
    />
  );
}
