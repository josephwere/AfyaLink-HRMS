import React from "react";
import ModuleWorkspace from "../../components/ModuleWorkspace";

export default function PatientFeedback() {
  return (
    <ModuleWorkspace
      title="Feedback"
      subtitle="Submit service feedback and track responses."
      actions={[{ label: "Submit Feedback", variant: "primary" }, { label: "View Responses" }]}
      panels={[
        { title: "New Feedback", body: "Capture care and service feedback." },
        { title: "History", body: "Past submissions and status." },
        { title: "Messages", body: "Response thread from support teams." },
      ]}
    />
  );
}
