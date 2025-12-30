import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../utils/auth";
import { useCan } from "../hooks/useCan";
import { fetchMenu } from "../services/menuApi";

export default function Sidebar() {
  const { user } = useAuth();
  const { can } = useCan();
  const [dynamicMenu, setDynamicMenu] = useState([]);
  const [menuLoaded, setMenuLoaded] = useState(false);

  useEffect(() => {
    fetchMenu()
      .then((res) => {
        setDynamicMenu(res.menu || []);
        setMenuLoaded(true);
      })
      .catch(() => {
        setDynamicMenu([]);
        setMenuLoaded(true);
      });
  }, []);

  if (!user) return null;

  const UnverifiedBadge = () =>
    !user.emailVerified ? (
      <span
        style={{
          marginLeft: 6,
          background: "#dc2626",
          color: "#fff",
          borderRadius: "50%",
          width: 16,
          height: 16,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        !
      </span>
    ) : null;

  /* ================= GUEST ================= */
  if (user.role === "GUEST") {
    return (
      <aside className="sidebar">
        <nav>
          <ul>
            <li>
              <Link to="/guest">Demo Home</Link>
            </li>

            <Section title="Demo">
              {can("ai", "chat") && <Item to="/ai/chatbot">AI Chatbot</Item>}
              {can("ai", "medical") && (
                <Item to="/ai/medical">AI Assistant</Item>
              )}
            </Section>
          </ul>
        </nav>

        <div className="sidebar-footer">AfyaLink • Demo Mode</div>
      </aside>
    );
  }

  /* ================= AUTHENTICATED ================= */
  return (
    <aside className="sidebar">
      <nav>
        <ul>
          {/* HOME */}
          <li>
            <Link to="/">
              Home <UnverifiedBadge />
            </Link>
          </li>

          {/* ================= BACKEND MENU (PRIMARY) ================= */}
          {menuLoaded &&
            dynamicMenu.length > 0 &&
            dynamicMenu.map((section) => (
              <Section key={section.section} title={section.section}>
                {section.items.map((item) => (
                  <Item key={item.path} to={item.path}>
                    {item.label}
                  </Item>
                ))}
              </Section>
            ))}

          {/* ================= STATIC FALLBACK (ONLY IF BACKEND EMPTY) ================= */}
          {menuLoaded && dynamicMenu.length === 0 && (
            <>
              {can("superadmin", "read") && (
                <>
                  <Section title="Super Admin">
                    <Item to="/superadmin">Dashboard</Item>
                    <Item to="/superadmin/rbac">RBAC</Item>
                    <Item to="/superadmin/ml">ML</Item>
                    <Item to="/analytics">Analytics</Item>
                    <Item to="/reports">Reports</Item>
                  </Section>

                  <Section title="Security & Governance">
                    <Item to="/admin/create-admin">Create Admin</Item>
                    <Item to="/admin/audit-logs">Audit Logs</Item>
                  </Section>
                </>
              )}

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

              {can("doctor", "read") && (
                <Section title="Doctor">
                  <Item to="/doctor">Dashboard</Item>
                  {can("appointments", "read") && (
                    <Item to="/doctor/appointments">Appointments</Item>
                  )}
                  {can("ai", "medical") && (
                    <Item to="/ai/medical">AI Assistant</Item>
                  )}
                  {can("ai", "triage") && (
                    <Item to="/ai/triage">Triage</Item>
                  )}
                  {can("ai", "voice") && (
                    <Item to="/ai/voice">Voice Dictation</Item>
                  )}
                </Section>
              )}

              {can("nurse", "read") && (
                <Section title="Nurse">
                  {can("ai", "medical") && (
                    <Item to="/ai/medical">AI Assistant</Item>
                  )}
                  {can("ai", "triage") && (
                    <Item to="/ai/triage">Triage</Item>
                  )}
                </Section>
              )}

              {can("lab", "read") && (
                <Section title="Laboratory">
                  <Item to="/labtech/labs">Lab Tests</Item>
                  <Item to="/lab">Lab Dashboard</Item>
                </Section>
              )}

              {can("patient", "read") && (
                <Section title="Patient">
                  <Item to="/patient">Dashboard</Item>
                  {can("payments", "read") && (
                    <Item to="/payments">Payments</Item>
                  )}
                  {can("ai", "chat") && (
                    <Item to="/ai/chatbot">Health Chatbot</Item>
                  )}
                </Section>
              )}

              {can("payments", "read") && (
                <Section title="Finance">
                  <Item to="/payments">Payments</Item>
                  <Item to="/payments/full">Advanced Payments</Item>
                </Section>
              )}

              {can("realtime", "read") && (
                <Section title="Realtime">
                  <Item to="/ai/ws">Live AI Chat</Item>
                </Section>
              )}
            </>
          )}

          {/* ================= ACCOUNT ================= */}
          <Section title="Account">
            <Item to="/profile">
              Profile <UnverifiedBadge />
            </Item>
          </Section>
        </ul>
      </nav>

      <div className="sidebar-footer">AfyaLink • Secure</div>
    </aside>
  );
}

/* ================= HELPERS ================= */

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
