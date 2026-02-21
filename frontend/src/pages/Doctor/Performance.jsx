import React from "react";
import DoctorModuleLayout from "./DoctorModuleLayout";

export default function Performance() {
  return (
    <DoctorModuleLayout
      title="Performance"
      subtitle="Operational and quality indicators aligned with HR performance evaluation."
      actions={[
        { label: "View Monthly KPIs", variant: "primary" },
        { label: "Export Metrics" },
      ]}
      kpis={[
        { title: "Patient Load", value: "Live" },
        { title: "Surgery Count", value: "Live" },
        { title: "Complication Rate", value: "Live" },
        { title: "Attendance", value: "Live" },
        { title: "Overtime", value: "Live" },
        { title: "Leave Balance", value: "Live" },
      ]}
      panels={[
        { title: "Clinical Outcomes", body: "Outcome and complication trend snapshots." },
        { title: "Experience", body: "Patient satisfaction and service metrics." },
      ]}
    />
  );
}
