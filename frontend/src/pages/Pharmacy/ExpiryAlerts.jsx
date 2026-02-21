import React from "react";
import ModuleWorkspace from "../../components/ModuleWorkspace";

export default function ExpiryAlerts() {
  return (
    <ModuleWorkspace
      title="Expiry Alerts"
      subtitle="Medication expiry surveillance and near-expiry action workflow."
      actions={[{ label: "Review Alerts", variant: "primary" }, { label: "Quarantine Batch" }]}
      panels={[
        { title: "Near Expiry", body: "Batches approaching expiry." },
        { title: "Expired", body: "Expired items requiring disposal records." },
        { title: "Actions", body: "Return, quarantine and replacement actions." },
      ]}
    />
  );
}
