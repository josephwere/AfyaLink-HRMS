import React from "react";
import DoctorModuleLayout from "./DoctorModuleLayout";

export default function MySchedule() {
  return (
    <DoctorModuleLayout
      title="My Schedule"
      subtitle="Daily, weekly and monthly clinical planning with shift overlays and surgery blocks."
      actions={[
        { label: "Day View", variant: "primary" },
        { label: "Week View" },
        { label: "Month View" },
      ]}
      kpis={[
        { title: "Today Blocks", value: "Live" },
        { title: "Recurring Clinics", value: "Enabled" },
        { title: "Telemedicine", value: "Enabled" },
        { title: "Multi-Branch", value: "Ready" },
      ]}
      panels={[
        { title: "Calendar Grid", body: "Color-coded OPD, surgery, ward rounds and leave overlays." },
        { title: "Shift Overlay", body: "On-call and regular shift windows overlaid on appointments." },
        { title: "Reschedule", body: "Drag and reschedule with automatic conflict checks." },
        { title: "Surgery Blocks", body: "Reserve and manage procedure slots." },
      ]}
    />
  );
}
