import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../utils/auth";

export default function Sidebar() {
  const { role } = useAuth();

  if (!role) return null;

  /* ================= GUEST (DEMO MODE) ================= */
  if (role === "guest") {
    return (
      <aside className="sidebar">
        <nav>
          <ul>
            <li><Link to="/guest">Demo Home</Link></li>

            <Section title="Demo">
              <Item to="/ai/chatbot">AI Chatbot</Item>
              <Item to="/ai/medical">AI Assistant</Item>
            </Section>
          </ul>
        </nav>

        <div className="sidebar-footer">AfyaLink • Demo Mode</div>
      </aside>
    );
  }

  /* ================= AUTHENTICATED USERS ================= */

  return (
    <aside className="sidebar">
      <nav>
        <ul>
          <li><Link to="/">Home</Link></li>

          {/* ================= SUPER ADMIN ================= */}
          {role === "SuperAdmin" && (
            <Section title="Super Admin">
              <Item to="/superadmin">Dashboard</Item>
              <Item to="/superadmin/rbac">RBAC</Item>
              <Item to="/superadmin/ml">ML</Item>
              <Item to="/analytics">Analytics</Item>
              <Item to="/reports">Reports</Item>
            </Section>
          )}

          {/* ================= HOSPITAL ADMIN ================= */}
          {["SuperAdmin", "HospitalAdmin"].includes(role) && (
            <>
              <Section title="Hospital Admin">
                <Item to="/hospitaladmin">Dashboard</Item>
                <Item to="/hospitaladmin/patients">Patients</Item>
                <Item to="/hospitaladmin/financials">Financials</Item>
                <Item to="/hospitaladmin/branches">Branches</Item>
                <Item to="/inventory">Inventory</Item>
                <Item to="/pharmacy">Pharmacy</Item>
              </Section>

              <Section title="Integrations">
                <Item to="/admin/realtime">Webhooks</Item>
                <Item to="/admin/crdt-patients">CRDT Editor</Item>
                <Item to="/admin/notifications">Notifications</Item>
              </Section>
            </>
          )}

          {/* ================= DOCTOR ================= */}
          {role === "Doctor" && (
            <Section title="Doctor">
              <Item to="/doctor">Dashboard</Item>
              <Item to="/doctor/appointments">Appointments</Item>
              <Item to="/ai/medical">AI Assistant</Item>
              <Item to="/ai/triage">Triage</Item>
              <Item to="/ai/voice">Voice Dictation</Item>
            </Section>
          )}

          {/* ================= NURSE ================= */}
          {role === "Nurse" && (
            <Section title="Nurse">
              <Item to="/ai/medical">AI Assistant</Item>
              <Item to="/ai/triage">Triage</Item>
            </Section>
          )}

          {/* ================= LAB TECH ================= */}
          {role === "LabTech" && (
            <Section title="Laboratory">
              <Item to="/labtech/labs">Lab Tests</Item>
              <Item to="/lab">Lab Dashboard</Item>
            </Section>
          )}

          {/* ================= PATIENT ================= */}
          {role === "Patient" && (
            <Section title="Patient">
              <Item to="/patient">Dashboard</Item>
              <Item to="/payments">Payments</Item>
              <Item to="/ai/chatbot">Health Chatbot</Item>
            </Section>
          )}

          {/* ================= PAYMENTS ================= */}
          {["Patient", "HospitalAdmin", "SuperAdmin"].includes(role) && (
            <Section title="Finance">
              <Item to="/payments">Payments</Item>
              <Item to="/payments/full">Advanced Payments</Item>
            </Section>
          )}

          {/* ================= REALTIME ================= */}
          {["Doctor", "Nurse", "Patient"].includes(role) && (
            <Section title="Realtime">
              <Item to="/ai/ws">Live AI Chat</Item>
            </Section>
          )}
        </ul>
      </nav>

      <div className="sidebar-footer">AfyaLink • Secure</div>
    </aside>
  );
}

/* ======================================================
   SMALL HELPERS (CLEAN JSX)
====================================================== */

function Section({ title, children }) {
  return (
    <>
      <li className="section-title">{title}</li>
      {children}
    </>
  );
}

function Item({ to, children }) {
  return (
    <li>
      <Link to={to}>{children}</Link>
    </li>
  );
}
