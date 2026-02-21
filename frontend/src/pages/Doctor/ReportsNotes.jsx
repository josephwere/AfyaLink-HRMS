import React from "react";
import DoctorModuleLayout from "./DoctorModuleLayout";

export default function ReportsNotes() {
  return (
    <DoctorModuleLayout
      title="Reports & Notes"
      subtitle="Case archive, research notes, exports and publication tracking."
      actions={[
        { label: "Open Reports", variant: "primary", path: "/reports" },
        { label: "New Note" },
      ]}
      panels={[
        { title: "Case Notes", body: "Structured archive of clinical notes." },
        { title: "Research Notes", body: "Research and academic note workspace." },
        { title: "Exports", body: "Downloadable report and performance data exports." },
      ]}
    />
  );
}
