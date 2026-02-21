import React from "react";
import DoctorModuleLayout from "./DoctorModuleLayout";

export default function InpatientWard() {
  return (
    <DoctorModuleLayout
      title="Inpatient Ward"
      subtitle="Bed assignments, daily progress, medication chart visibility and discharge workflow."
      actions={[
        { label: "Open Ward List", variant: "primary" },
        { label: "Generate Discharge" },
      ]}
      panels={[
        { title: "Assigned Beds", body: "Current inpatient allocation by ward and risk level." },
        { title: "Progress Notes", body: "Daily care progression and treatment milestones." },
        { title: "Nursing Notes", body: "Cross-functional clinical visibility with nurse inputs." },
        { title: "Mortality Review", body: "Outcome and review logs for governance." },
      ]}
    />
  );
}
