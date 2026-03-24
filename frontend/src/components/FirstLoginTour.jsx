import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../utils/auth";
import { useAppLanguage } from "../utils/appLanguage.jsx";

const COMMON_STEPS = [
  {
    title: "Welcome to AfyaLink",
    description: "Your workspace is personalized by role. Start with the sidebar and top search.",
    bullets: [
      "Use the sidebar to access all modules for your role",
      "Use global search to find people, tasks, and reports quickly",
      "Check notifications for approvals and reminders",
    ],
    ctaLabel: "Go to Dashboard",
    ctaPathByRole: {},
  },
  {
    title: "Secure Your Account",
    description: "Complete profile verification so your account remains protected and fully active.",
    bullets: [
      "Verify phone and email",
      "Add national ID and emergency contact",
      "Enable two-factor authentication",
    ],
    ctaLabel: "Open Profile",
    ctaPathByRole: { default: "/profile" },
  },
];

const ROLE_STEPS = {
  SUPER_ADMIN: [
    {
      title: "Global Operations",
      description: "Monitor hospital growth, platform health, and cross-tenant operations.",
      bullets: [
        "Review hospitals, plans, and subscription state",
        "Track system-wide alerts and compliance risk",
        "Use analytics and reports for strategic decisions",
      ],
      ctaLabel: "Open Super Admin",
      ctaPathByRole: { default: "/super-admin" },
    },
  ],
  SYSTEM_ADMIN: [
    {
      title: "Platform Administration",
      description: "Keep services healthy and policy enforcement consistent.",
      bullets: [
        "Review system metrics, logs, and queue status",
        "Manage ABAC policies and system settings",
        "Validate integrations and mapping studio",
      ],
      ctaLabel: "Open System Admin",
      ctaPathByRole: { default: "/system-admin" },
    },
  ],
  HOSPITAL_ADMIN: [
    {
      title: "Hospital Control Center",
      description: "Manage workforce operations and hospital configuration.",
      bullets: [
        "Review approvals for leave, overtime, and shift requests",
        "Register staff and assign role access",
        "Configure payments, insurance providers, and ads",
      ],
      ctaLabel: "Open Hospital Admin",
      ctaPathByRole: { default: "/hospital-admin" },
    },
  ],
  DOCTOR: [
    {
      title: "Clinical Workflow",
      description: "Start with schedule and patient queue to run consultations faster.",
      bullets: [
        "Open appointments and today schedule",
        "Use OPD workspace for notes, diagnosis, and follow-up",
        "Manage prescriptions, referrals, and lab reviews",
      ],
      ctaLabel: "Open My Schedule",
      ctaPathByRole: { default: "/doctor/schedule" },
    },
  ],
  NURSE: [
    {
      title: "Nursing Workflow",
      description: "Handle shifts, medication tasks, and patient monitoring from one place.",
      bullets: [
        "Check assigned patients and shift details",
        "Log medication/vitals and incidents",
        "Submit leave and overtime requests as needed",
      ],
      ctaLabel: "Open Nurse Dashboard",
      ctaPathByRole: { default: "/nurse" },
    },
  ],
  LAB_TECH: [
    {
      title: "Lab Operations",
      description: "Track queue, equipment status, and urgent tests with fewer clicks.",
      bullets: [
        "Process pending tests by urgency",
        "Review safety checklist and equipment logs",
        "Publish and archive lab reports",
      ],
      ctaLabel: "Open Lab Dashboard",
      ctaPathByRole: { default: "/lab-tech" },
    },
  ],
  PHARMACIST: [
    {
      title: "Pharmacy Operations",
      description: "Manage dispensing, stock, and controlled drugs safely.",
      bullets: [
        "Work through prescription queue",
        "Track inventory and expiry alerts",
        "Review controlled drugs and supplier orders",
      ],
      ctaLabel: "Open Pharmacy",
      ctaPathByRole: { default: "/pharmacy" },
    },
  ],
  HR_MANAGER: [
    {
      title: "HR Workflow",
      description: "Run recruitment, contracts, leave, and performance in one flow.",
      bullets: [
        "Review onboarding and recruitment pipeline",
        "Approve or escalate workforce requests",
        "Track compliance and staff profile completeness",
      ],
      ctaLabel: "Open HR Dashboard",
      ctaPathByRole: { default: "/hr-manager" },
    },
  ],
  PAYROLL_OFFICER: [
    {
      title: "Payroll Workflow",
      description: "Prepare and validate payroll with audit visibility.",
      bullets: [
        "Run payroll and check pending approvals",
        "Validate overtime, deductions, and tax reports",
        "Generate payslips and export finance records",
      ],
      ctaLabel: "Open Payroll Dashboard",
      ctaPathByRole: { default: "/payroll-officer" },
    },
  ],
  COMMUNITY_HEALTH_WORKER: [
    {
      title: "Community Outreach Workflow",
      description: "Run household visits offline, sync later, and escalate to hospital teams.",
      bullets: [
        "Register households and record field visits from mobile-friendly screens",
        "Track maternal/child, vaccination, chronic, and surveillance updates",
        "Create referrals and communicate with hospital operations channel",
      ],
      ctaLabel: "Open CHW Dashboard",
      ctaPathByRole: { default: "/community-health-worker" },
    },
  ],
  PATIENT: [
    {
      title: "Patient Self-Service",
      description: "Book appointments, pay bills, and manage records from your dashboard.",
      bullets: [
        "Find hospitals and book appointments",
        "Track prescriptions, lab results, and bills",
        "View insurance details and alerts",
      ],
      ctaLabel: "Open My Hospitals",
      ctaPathByRole: { default: "/patient/hospitals" },
    },
  ],
};

export default function FirstLoginTour() {
  const { user } = useAuth();
  const { translateText } = useAppLanguage();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const effectiveRole = (user?.actualRole || user?.role || "").toUpperCase();

  const steps = useMemo(() => {
    const roleSteps = ROLE_STEPS[effectiveRole] || [];
    return [...COMMON_STEPS, ...roleSteps];
  }, [effectiveRole]);

  useEffect(() => {
    if (!user?.id) return;
    const key = `tour_seen_${user.id}_${effectiveRole || "DEFAULT"}`;
    const seen = localStorage.getItem(key) === "true";
    if (!seen) {
      setIndex(0);
      setOpen(true);
    }
  }, [user?.id, effectiveRole]);

  const close = () => {
    if (user?.id) {
      localStorage.setItem(`tour_seen_${user.id}_${effectiveRole || "DEFAULT"}`, "true");
    }
    setOpen(false);
  };

  const current = steps[index];
  if (!open || !current) return null;

  const canGoBack = index > 0;
  const isLast = index >= steps.length - 1;
  const ctaPath = current.ctaPathByRole?.[effectiveRole] || current.ctaPathByRole?.default;

  return (
    <div className="tour-backdrop" role="dialog" aria-modal="true">
      <div className="tour-modal">
        <button type="button" className="tour-close" onClick={close} aria-label={translateText("Close")}>
          ×
        </button>
        <div className="muted" style={{ marginBottom: 8 }}>
          {translateText(`Step ${index + 1} of ${steps.length}`)}
        </div>
        <h3>{translateText(current.title)}</h3>
        <p className="muted">{translateText(current.description)}</p>
        <ul className="tour-list">
          {current.bullets?.map((b) => (
            <li key={b}>{translateText(b)}</li>
          ))}
        </ul>
        <div className="tour-actions">
          <button type="button" className="btn-secondary" onClick={close}>
            {translateText("Skip Tour")}
          </button>
          {canGoBack && (
            <button type="button" className="btn-secondary" onClick={() => setIndex((v) => Math.max(0, v - 1))}>
              {translateText("Back")}
            </button>
          )}
          {ctaPath && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate(ctaPath)}
            >
              {translateText(current.ctaLabel || "Open")}
            </button>
          )}
          {!isLast ? (
            <button type="button" className="btn-primary" onClick={() => setIndex((v) => v + 1)}>
              {translateText("Next")}
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={close}>
              {translateText("Finish")}
            </button>
          )}
        </div>
        <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
          {translateText("You can reopen this guide from Help if needed.")}
        </div>
      </div>
    </div>
  );
}
