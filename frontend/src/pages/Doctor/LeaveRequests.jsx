import React from "react";
import { useNavigate } from "react-router-dom";
import DoctorModuleLayout from "./DoctorModuleLayout";

export default function LeaveRequests() {
  const navigate = useNavigate();

  return (
    <DoctorModuleLayout
      title="Leave Requests"
      subtitle="Manage leave balance, request submissions, approvals and shift impact."
      actions={[
        { label: "Open My Requests", variant: "primary", onClick: () => navigate("/workforce/requests#leave") },
        { label: "Request Overtime", onClick: () => navigate("/workforce/requests#overtime") },
        { label: "Request Shift", onClick: () => navigate("/workforce/requests#shift") },
      ]}
      panels={[
        { title: "Leave Balance", body: "Current available leave and planned allocations." },
        { title: "Approval Status", body: "Pending, approved and rejected history." },
        { title: "Shift Impact", body: "Coverage and continuity preview before submission." },
      ]}
    />
  );
}
