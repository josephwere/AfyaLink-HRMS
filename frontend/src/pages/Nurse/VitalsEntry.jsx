import React from "react";
import ModuleWorkspace from "../../components/ModuleWorkspace";

export default function VitalsEntry() {
  return (
    <ModuleWorkspace
      title="Vitals Entry"
      subtitle="Record patient vitals and flag abnormal trends for review."
      actions={[{ label: "New Vitals Record", variant: "primary" }, { label: "Trend View" }]}
      panels={[
        { title: "Vitals Form", body: "BP, pulse, temperature, SpO2 and pain scale inputs." },
        { title: "Trend Graphs", body: "Historical progression for quick deterioration detection." },
        { title: "Alerts", body: "Abnormal values push real-time alerts to care team." },
      ]}
    />
  );
}
