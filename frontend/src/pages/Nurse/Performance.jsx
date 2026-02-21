import React from "react";
import ModuleWorkspace from "../../components/ModuleWorkspace";

export default function NursePerformance() {
  return (
    <ModuleWorkspace
      title="Performance"
      subtitle="Attendance, task completion and supervisor feedback metrics."
      kpis={[
        { title: "Attendance", value: "Live" },
        { title: "Task Completion", value: "Live" },
        { title: "Supervisor Feedback", value: "Live" },
      ]}
      panels={[
        { title: "Shift Score", body: "Shift punctuality and completion summary." },
        { title: "Care Quality", body: "Clinical task quality and incident ratio." },
      ]}
    />
  );
}
