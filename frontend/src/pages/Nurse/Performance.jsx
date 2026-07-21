import React from "react";
import ModuleWorkspace from "../../components/ModuleWorkspace";
import { useNurseDashboard } from "../../hooks/useNurseDashboard";

export default function NursePerformance() {
  const { pendingTransferCount, openEscalationCount, patientsTotal, loading } = useNurseDashboard();

  return (
    <div className="dashboard">
      <ModuleWorkspace
        title="Performance"
        subtitle="Attendance, task completion and supervisor feedback metrics."
        kpis={[
          { title: "Attendance", value: "Live" },
          { title: "Task Completion", value: patientsTotal || "Live" },
          { title: "Supervisor Feedback", value: openEscalationCount || "Live" },
        ]}
        panels={[
          { title: "Shift Score", body: `Shift punctuality and completion summary${loading ? "" : ` with ${pendingTransferCount} pending transfer follow-ups`}.` },
          { title: "Care Quality", body: "Clinical task quality and incident ratio." },
        ]}
      />
    </div>
  );
}
