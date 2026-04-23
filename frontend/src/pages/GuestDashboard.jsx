import React from "react";
import DashboardHomeShell, { DashboardSection } from "../components/DashboardHomeShell";
import { ActionCard } from "../components/Cards";

export default function GuestDashboard() {
  return (
    <DashboardHomeShell
      shellKey="portal_guest_home"
      kicker="Patient Portal"
      title="Guest access"
      subtitle="Browse services, start a booking request, and create an account when you need records, billing, or transfer history."
      actions={[
        { label: "Create account", path: "/register" },
        { label: "Sign In", path: "/login", variant: "secondary" },
      ]}
      stats={[
        { label: "Hospitals", value: "Browse", path: "/app/portal/discovery/hospitals" },
        { label: "Appointments", value: "Request", path: "/app/portal/appointments/index" },
        { label: "Support", value: "Contact", path: "/app/portal/support/feedback" },
      ]}
    >
      <DashboardSection
        title="Guest Services"
        subtitle="Everything in this section can be opened before you create an account."
      >
        <div className="dashboard-shelf-grid">
          <ActionCard
            title="Find a hospital"
            description="Browse facilities, services, and contact channels."
            footerLabel="Open discovery"
            path="/app/portal/discovery/hospitals"
          />
          <ActionCard
            title="Start appointment booking"
            description="Start a booking request and create an account when you need updates and reminders."
            footerLabel="Start booking"
            path="/register"
          />
          <ActionCard
            title="Share feedback"
            description="Send a support note or request help from the portal team."
            footerLabel="Open support"
            path="/app/portal/support/feedback"
          />
          <ActionCard
            title="Explore records demo"
            description="Preview how your medical records and timelines will look after sign-in."
            footerLabel="Open records"
            path="/app/portal/records/index"
          />
        </div>
      </DashboardSection>

      <DashboardSection
        title="What requires sign-in"
        subtitle="These workflows are available after account verification."
      >
        <div className="alert-stack">
          <div className="alert-item">Transfer continuity and clinical handoff timelines.</div>
          <div className="alert-item">Insurance, billing, and payment receipts.</div>
          <div className="alert-item">Family linking, dependent records, and consent workflows.</div>
        </div>
      </DashboardSection>
    </DashboardHomeShell>
  );
}
