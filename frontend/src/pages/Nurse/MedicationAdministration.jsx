import React from "react";
import ModuleWorkspace from "../../components/ModuleWorkspace";
import { useNurseDashboard } from "../../hooks/useNurseDashboard";

export default function MedicationAdministration() {
  const { pendingLabOrders, pendingTransferCount, loading } = useNurseDashboard();

  return (
    <div className="dashboard">
      <ModuleWorkspace
        title="Medication Administration"
        subtitle="Due medications, verification checks and administration logs."
        actions={[
          { label: "Open MAR", variant: "primary", path: "/nurse/medication#mar" },
          { label: "Drug Interaction Check", path: "/doctor/prescriptions#interactions" },
        ]}
        kpis={[
          { title: "Medication Due Alerts", value: pendingLabOrders, subtitle: loading ? "Refreshing" : "Needs bedside review" },
          { title: "Pending Transfers", value: pendingTransferCount, subtitle: "Medication continuity" },
        ]}
        panels={[
          { title: "Due Medications", body: "Upcoming medication tasks by time." },
          { title: "Verification", body: "Patient, dose and route verification controls." },
          { title: "Administration Log", body: "Time-stamped medication administration records." },
        ]}
      />
    </div>
  );
}
