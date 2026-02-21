import React from "react";
import ModuleWorkspace from "../../components/ModuleWorkspace";

export default function SampleTracking() {
  return (
    <ModuleWorkspace
      title="Sample Tracking"
      subtitle="Monitor sample lifecycle from collection to result release."
      actions={[{ label: "Track Sample", variant: "primary" }, { label: "Flag Delay" }]}
      panels={[
        { title: "Collection", body: "Collected sample inventory and timestamps." },
        { title: "Processing", body: "In-lab progress state and queue slot." },
        { title: "Release", body: "Result-ready and signed-off status." },
      ]}
    />
  );
}
