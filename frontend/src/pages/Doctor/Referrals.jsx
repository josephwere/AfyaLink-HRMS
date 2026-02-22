import React from "react";
import DoctorModuleLayout from "./DoctorModuleLayout";

export default function Referrals() {
  return (
    <DoctorModuleLayout
      title="Referrals"
      subtitle="Internal and external referrals with specialist transfer status tracking."
      actions={[
        { label: "New Internal Referral", variant: "primary", path: "/doctor/referrals#internal" },
        { label: "New External Referral", path: "/doctor/referrals#external" },
      ]}
      panels={[
        { title: "Internal Referrals", body: "Intra-hospital specialist handoffs." },
        { title: "External Referrals", body: "Cross-facility referral generation and tracking." },
        { title: "Transfer Status", body: "Pending, accepted, completed and declined states." },
      ]}
    />
  );
}
