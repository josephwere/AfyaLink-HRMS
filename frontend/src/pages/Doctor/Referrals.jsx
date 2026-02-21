import React from "react";
import DoctorModuleLayout from "./DoctorModuleLayout";

export default function Referrals() {
  return (
    <DoctorModuleLayout
      title="Referrals"
      subtitle="Internal and external referrals with specialist transfer status tracking."
      actions={[
        { label: "New Internal Referral", variant: "primary" },
        { label: "New External Referral" },
      ]}
      panels={[
        { title: "Internal Referrals", body: "Intra-hospital specialist handoffs." },
        { title: "External Referrals", body: "Cross-facility referral generation and tracking." },
        { title: "Transfer Status", body: "Pending, accepted, completed and declined states." },
      ]}
    />
  );
}
