import React from "react";
import DoctorModuleLayout from "./DoctorModuleLayout";

export default function OPDWorkspace() {
  return (
    <DoctorModuleLayout
      title="OPD Clinic Workspace"
      subtitle="Consultation screen for diagnosis, notes, coding, treatment and follow-up."
      actions={[
        { label: "Open Consultation", variant: "primary" },
        { label: "Print Summary" },
        { label: "Send to Pharmacy" },
      ]}
      panels={[
        { title: "Patient Summary", body: "Vitals, allergies and insurance context." },
        { title: "Clinical Notes", body: "Auto-save notes editor with diagnosis and ICD coding." },
        { title: "Orders & Referrals", body: "Lab orders, prescriptions, specialist referrals and follow-up." },
        { title: "Consultation Actions", body: "Save & close, print summary and route to pharmacy." },
      ]}
    />
  );
}
