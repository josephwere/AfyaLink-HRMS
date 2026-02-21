import React from "react";
import ModuleWorkspace from "../../components/ModuleWorkspace";

export default function MyShift() {
  return (
    <ModuleWorkspace
      title="My Shift"
      subtitle="Current shift details, handover notes and real-time ward responsibilities."
      actions={[{ label: "Start Round", variant: "primary" }, { label: "Handover Notes" }]}
      panels={[
        { title: "Shift Window", body: "Current shift block and assigned zone." },
        { title: "Handover", body: "Incoming and outgoing shift notes." },
        { title: "Coverage", body: "Staff coverage snapshot for your unit." },
      ]}
    />
  );
}
