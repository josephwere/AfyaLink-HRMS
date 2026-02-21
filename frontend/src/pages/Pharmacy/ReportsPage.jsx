import React from "react";
import ModuleWorkspace from "../../components/ModuleWorkspace";

export default function PharmacyReportsPage() {
  return (
    <ModuleWorkspace
      title="Pharmacy Reports"
      subtitle="Dispense volumes, controlled logs and inventory audit reports."
      actions={[{ label: "Open Reports", variant: "primary", path: "/reports" }, { label: "Export CSV" }]}
      panels={[
        { title: "Dispense Trends", body: "Daily and monthly dispensing analysis." },
        { title: "Controlled Audit", body: "Controlled drug variance and audit trail." },
        { title: "Inventory Reports", body: "Consumption and procurement reports." },
      ]}
    />
  );
}
