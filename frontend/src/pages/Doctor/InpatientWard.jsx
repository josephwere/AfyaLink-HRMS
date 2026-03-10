import React from "react";
import DoctorModuleLayout from "./DoctorModuleLayout";

export default function InpatientWard() {
  return (
    <DoctorModuleLayout
      title="Inpatient Ward"
      subtitle="Live ward occupancy, patient movement timeline, nursing visibility, and discharge context."
      actions={[
        { label: "Open Live Ward Board", variant: "primary", path: "/doctor/ward-board" },
        { label: "Transfer Command Center", path: "/hospital-admin/transfer-command-center" },
      ]}
      panels={[
        { title: "Assigned Beds", body: "See current inpatient allocation by ward, patient, and occupancy." },
        { title: "Bed Timeline", body: "Review transfers, discharges, and release history before decisions." },
        { title: "Nursing Notes", body: "Use the live board together with nurse ward actions and timeline context." },
        { title: "Discharge Context", body: "Discharges stay linked to encounter closure and transfer continuity." },
      ]}
    />
  );
}
