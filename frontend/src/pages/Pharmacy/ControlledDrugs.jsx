import React from "react";
import ModuleWorkspace from "../../components/ModuleWorkspace";

export default function ControlledDrugs() {
  return (
    <ModuleWorkspace
      title="Controlled Drugs"
      subtitle="Controlled medication ledger, issue/return logs and compliance checks."
      actions={[{ label: "Open Controlled Log", variant: "primary" }, { label: "Audit Export" }]}
      panels={[
        { title: "Dispense Log", body: "Controlled drug issue records." },
        { title: "Stock Checks", body: "Count reconciliation and discrepancy flags." },
        { title: "Compliance", body: "Regulatory controls and audit artifacts." },
      ]}
    />
  );
}
