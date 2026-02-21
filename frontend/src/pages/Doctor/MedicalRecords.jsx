import React from "react";
import DoctorModuleLayout from "./DoctorModuleLayout";

export default function MedicalRecords() {
  return (
    <DoctorModuleLayout
      title="Medical Records"
      subtitle="Longitudinal patient history across visits, surgeries, labs, radiology and attachments."
      actions={[
        { label: "Open Patient Timeline", variant: "primary" },
        { label: "Upload Attachment" },
      ]}
      panels={[
        { title: "Visit History", body: "Past consultations and clinical notes timeline." },
        { title: "Clinical History", body: "Surgeries, immunizations and chronic history." },
        { title: "Diagnostics", body: "Lab and radiology history with trend support." },
        { title: "Attachments", body: "Secure PDFs and imaging artifacts." },
      ]}
    />
  );
}
