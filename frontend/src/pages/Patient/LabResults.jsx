import React from "react";
import ModuleWorkspace from "../../components/ModuleWorkspace";
import GuidedEmptyState from "../../components/GuidedEmptyState";

export default function PatientLabResults() {
  const openAiAssistant = () => {
    window.dispatchEvent(
      new CustomEvent("afyalink:ai-open", {
        detail: {
          prompt:
            "Explain my lab results in simple language and help me prepare safe questions for my clinician. Do not diagnose me; focus on what to discuss with a healthcare professional.",
          source: "patient-lab-results",
        },
      })
    );
  };

  return (
    <ModuleWorkspace
      title="Lab Results"
      subtitle="View completed labs, flagged values and trend history."
      actions={[
        { label: "View Results", variant: "primary", path: "/patient/lab-results#results" },
        { label: "Explain Results", onClick: openAiAssistant },
        { label: "Download PDF", onClick: () => window.print() },
      ]}
      panels={[
        { title: "Completed", body: "Completed test result archive with clinician-reviewed records." },
        { title: "Flagged", body: "Values that may need review with your healthcare provider." },
        { title: "AI Explanation", body: "Ask the assistant to summarize results and prepare questions before your visit." },
        { title: "Trends", body: "Historic result trends over time." },
      ]}
    >
      <section className="section" id="results">
        <GuidedEmptyState
          icon="LAB"
          title="No Lab Results Available"
          body="Once tests are completed and reviewed, results will appear here."
          actions={[
            { label: "Ask AI About Testing", onClick: openAiAssistant },
          ]}
        />
      </section>
    </ModuleWorkspace>
  );
}
