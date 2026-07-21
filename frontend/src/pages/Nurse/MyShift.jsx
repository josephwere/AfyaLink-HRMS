import React from "react";
import ModuleWorkspace from "../../components/ModuleWorkspace";
import { useNurseDashboard } from "../../hooks/useNurseDashboard";

export default function MyShift() {
  const { patientsTotal, pendingTransferCount, loading } = useNurseDashboard();

  return (
    <div className="dashboard">
      <ModuleWorkspace
        title="My Shift"
        subtitle="Current shift details, handover notes and real-time ward responsibilities."
        actions={[
          { label: "Start Round", variant: "primary", path: "/nurse/patients" },
          { label: "Handover Notes", path: "/communication" },
        ]}
        kpis={[
          { title: "Assigned Patients", value: patientsTotal, subtitle: loading ? "Refreshing" : "Current workload" },
          { title: "Pending Transfers", value: pendingTransferCount, subtitle: "Shift handoff queue" },
        ]}
        panels={[
          { title: "Shift Window", body: "Current shift block and assigned zone." },
          { title: "Handover", body: "Incoming and outgoing shift notes." },
          { title: "Coverage", body: "Staff coverage snapshot for your unit." },
        ]}
      />
    </div>
  );
}
