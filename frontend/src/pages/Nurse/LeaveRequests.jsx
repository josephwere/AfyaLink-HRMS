import React from "react";
import ModuleWorkspace from "../../components/ModuleWorkspace";
import { useNurseDashboard } from "../../hooks/useNurseDashboard";

export default function NurseLeaveRequests() {
  const { pendingLeaveRequests, pendingTransferCount, loading } = useNurseDashboard();

  return (
    <div className="dashboard">
      <ModuleWorkspace
        title="Leave Requests"
        subtitle="Leave balance, submission workflow and shift coverage impact preview."
        actions={[
          { label: "Request Leave", variant: "primary", path: "/workforce/requests#leave" },
          { label: "Request Overtime", path: "/workforce/requests#overtime" },
        ]}
        kpis={[
          { title: "Pending Leave", value: pendingLeaveRequests, subtitle: loading ? "Refreshing" : "Awaiting approval" },
          { title: "Pending Transfers", value: pendingTransferCount, subtitle: "Coverage handoff pressure" },
        ]}
        panels={[
          { title: "Balance", body: "Current leave and carry-over totals." },
          { title: "Request History", body: "Approved, rejected and pending requests." },
          { title: "Coverage", body: "Shift impact preview before submit." },
        ]}
      />
    </div>
  );
}
