import React from "react";
import DoctorModuleLayout from "./DoctorModuleLayout";

export default function CMECertifications() {
  return (
    <DoctorModuleLayout
      title="CME & Certifications"
      subtitle="License expiry, CME tracking, certificate vault and compliance reminders."
      actions={[
        { label: "Upload Certificate", variant: "primary" },
        { label: "View Training Calendar" },
      ]}
      panels={[
        { title: "License Status", body: "License number and expiry countdown." },
        { title: "CME Credits", body: "Credits earned and upcoming requirement targets." },
        { title: "Compliance Alerts", body: "Expiring credentials and mandatory training reminders." },
      ]}
    />
  );
}
