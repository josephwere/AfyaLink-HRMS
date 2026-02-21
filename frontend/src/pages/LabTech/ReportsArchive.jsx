import React from "react";
import ModuleWorkspace from "../../components/ModuleWorkspace";

export default function ReportsArchive() {
  return (
    <ModuleWorkspace
      title="Reports Archive"
      subtitle="Historical lab reports and export-ready records."
      actions={[{ label: "Open Reports", variant: "primary", path: "/reports" }, { label: "Export Archive" }]}
      panels={[
        { title: "Completed Reports", body: "Finalized reports by date and type." },
        { title: "Urgent Flags", body: "Priority report history and turnaround." },
      ]}
    />
  );
}
