import React from "react";
import ModuleWorkspace from "../../components/ModuleWorkspace";

export default function NurseLeaveRequests() {
  return (
    <ModuleWorkspace
      title="Leave Requests"
      subtitle="Leave balance, submission workflow and shift coverage impact preview."
      actions={[
        { label: "Request Leave", variant: "primary", path: "/workforce/requests#leave" },
        { label: "Request Overtime", path: "/workforce/requests#overtime" },
      ]}
      panels={[
        { title: "Balance", body: "Current leave and carry-over totals." },
        { title: "Request History", body: "Approved, rejected and pending requests." },
        { title: "Coverage", body: "Shift impact preview before submit." },
      ]}
    />
  );
}
