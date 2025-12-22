import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../utils/auth";
import { useCan } from "../hooks/useCan";

export default function Sidebar() {
  const { user } = useAuth();
  const { can } = useCan();

  if (!user) return null;

  /* ================= GUEST (DEMO MODE) ================= */
  if (user.role === "guest") {
    return (
      <aside className="sidebar">
        <nav>
          <ul>
            <li><Link to="/guest">Demo Home</Link></li>

            <Section title="Demo">
              {can("ai", "chat") && <Item to="/ai/chatbot">AI Chatbot</Item>}
              {can("ai", "medical") && <Item to="/ai/medical">AI Assistant</Item>}
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
          {can("superadmin", "read") && (
            <Section title="Super Admin">
              <Item to="/superadmin">Dashboard</Item>
              <Item to="/superadmin/rbac">RBAC</Item>
              <Item to="/superadmin/ml">ML</Item>
              <Item to="/analytics">Analytics</Item>
              <Item to="/reports">Reports</Item>
            </Section>
          )}

          {/* ================= HOSPITAL ADMIN ================= */}
          {can("hospital", "manage") && (
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
          {can("doctor", "read") && (
            <Section title="Doctor">
              <Item to="/doctor">Dashboard</Item>
              {can("appointments", "read") && (
                <Item to="/doctor/appointments">Appointments</Item>
              )}
              {can("ai", "medical") && <Item to="/ai/medical">AI Assistant</Item>}
              {can("ai", "triage") && <Item to="/ai/triage">Triage</Item>}
              {can("ai", "voice") && <Item to="/ai/voice">Voice Dictation</Item>}
            </Section>
          )}

          {/* ================= NURSE ================= */}
          {can("nurse", "read") && (
            <Section title="Nurse">
              {can("ai", "medical") && <Item to="/ai/medical">AI Assistant</Item>}
              {can("ai", "triage") && <Item to="/ai/triage">Triage</Item>}
            </Section>
          )}

          {/* ================= LAB TECH ================= */}
          {can("lab", "read") && (
            <Section title="Laboratory">
              <Item to="/labtech/labs">Lab Tests</Item>
              <Item to="/lab">Lab Dashboard</Item>
            </Section>
          )}

          {/* ================= PATIENT ================= */}
          {can("patient", "read") && (
            <Section title="Patient">
              <Item to="/patient">Dashboard</Item>
              {can("payments", "read") && <Item to="/payments">Payments</Item>}
              {can("ai", "chat") && <Item to="/ai/chatbot">Health Chatbot</Item>}
            </Section>
          )}

          {/* ================= PAYMENTS ================= */}
          {can("payments", "read") && (
            <Section title="Finance">
              <Item to="/payments">Payments</Item>
              <Item to="/payments/full">Advanced Payments</Item>
            </Section>
          )}

          {/* ================= REALTIME ================= */}
          {can("realtime", "read") && (
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
