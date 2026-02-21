import React from "react";
import DoctorModuleLayout from "./DoctorModuleLayout";

export default function DoctorSettings() {
  return (
    <DoctorModuleLayout
      title="Doctor Settings"
      subtitle="Profile, availability, notifications, signature and account security controls."
      actions={[
        { label: "Open Profile", variant: "primary", path: "/profile" },
        { label: "Notification Preferences" },
      ]}
      panels={[
        { title: "Availability", body: "Clinic windows and scheduling preferences." },
        { title: "Digital Signature", body: "Upload and manage document signature identity." },
        { title: "Security", body: "2FA, session and account protection options." },
        { title: "Theme", body: "Light, dark and system display mode preferences." },
      ]}
    />
  );
}
