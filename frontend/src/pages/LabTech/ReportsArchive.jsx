import React from "react";
import ModuleWorkspace from "../../components/ModuleWorkspace";

const exportArchiveSnapshot = () => {
  const snapshot = {
    generatedAt: new Date().toISOString(),
    equipmentLogs: JSON.parse(localStorage.getItem("labtech_equipment_logs") || "[]"),
    sampleTracking: JSON.parse(localStorage.getItem("labtech_sample_tracking") || "[]"),
    qualityControl: JSON.parse(localStorage.getItem("labtech_quality_control_runs") || "[]"),
    safetyChecks: JSON.parse(localStorage.getItem("labtech_safety_checks") || "[]"),
  };
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lab-archive-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

export default function ReportsArchive() {
  return (
    <ModuleWorkspace
      title="Reports Archive"
      subtitle="Historical lab reports and export-ready records."
      actions={[
        { label: "Open Reports", variant: "primary", path: "/reports" },
        { label: "Export Archive", onClick: exportArchiveSnapshot },
      ]}
      panels={[
        { title: "Completed Reports", body: "Finalized reports by date and type." },
        { title: "Urgent Flags", body: "Priority report history and turnaround." },
      ]}
    />
  );
}
