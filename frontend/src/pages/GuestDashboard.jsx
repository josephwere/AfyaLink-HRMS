import React from "react";
import DashboardHomeShell, { DashboardSection } from "../components/DashboardHomeShell";
import { ActionCard } from "../components/Cards";

export default function GuestDashboard() {
  return (
    <DashboardHomeShell
      shellKey="portal_guest_home"
      kicker="Patient Portal"
      title="Guest Access"
      subtitle="Browse services and start a booking flow. Sign in when you want to manage appointments, records, or transfers."
      actions={[
        { label: "Book Appointment", path: "/register" },
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
        subtitle="Everything here is safe to explore before you create an account."
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
            description="Begin a booking flow and create your account when ready."
            footerLabel="Book an appointment"
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
        title="What Requires Sign-In"
        subtitle="These workflows unlock once you authenticate."
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
