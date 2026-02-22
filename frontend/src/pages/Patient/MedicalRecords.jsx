import React from "react";
import ModuleWorkspace from "../../components/ModuleWorkspace";

export default function PatientMedicalRecords() {
  return (
    <ModuleWorkspace
      title="Medical Records"
      subtitle="Personal longitudinal records across visits, procedures, labs and files."
      actions={[
        { label: "Open Timeline", variant: "primary", path: "/patient/medical-records#timeline" },
        { label: "Download Record", onClick: () => window.print() },
      ]}
      panels={[
        { title: "Visits", body: "Consultation and admission history." },
        { title: "Procedures", body: "Procedure and treatment history." },
        { title: "Attachments", body: "Uploaded reports and supporting documents." },
      ]}
    />
  );
}
