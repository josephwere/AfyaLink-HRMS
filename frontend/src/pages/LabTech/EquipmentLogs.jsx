import React from "react";
import ModuleWorkspace from "../../components/ModuleWorkspace";

export default function EquipmentLogs() {
  return (
    <ModuleWorkspace
      title="Equipment Logs"
      subtitle="Track machine uptime, calibration and maintenance events."
      actions={[{ label: "New Log", variant: "primary" }, { label: "Maintenance Calendar" }]}
      panels={[
        { title: "Uptime", body: "Device uptime and downtime events." },
        { title: "Calibration", body: "Calibration due dates and completion records." },
        { title: "Maintenance", body: "Scheduled and emergency maintenance logs." },
      ]}
    />
  );
}
