import React from "react";
import DoctorModuleLayout from "./DoctorModuleLayout";

export default function Prescriptions() {
  return (
    <DoctorModuleLayout
      title="Prescriptions"
      subtitle="Drug search, interaction warnings, dosage guidance and secure e-prescription export."
      actions={[
        { label: "Create Prescription", variant: "primary" },
        { label: "Interaction Check" },
      ]}
      panels={[
        { title: "Medication Builder", body: "Search, dose, route, duration and refill controls." },
        { title: "Interaction Warnings", body: "Safety checks and allergy conflict alerts." },
        { title: "Controlled Drugs", body: "Controlled medication tracking and review logs." },
        { title: "Export", body: "Signed e-prescription output for pharmacy workflow." },
      ]}
    />
  );
}
