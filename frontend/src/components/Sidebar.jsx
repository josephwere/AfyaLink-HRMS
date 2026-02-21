import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../utils/auth";
import { useCan } from "../hooks/useCan";
import { fetchMenu } from "../services/menuApi";
import { redirectByRole } from "../utils/redirectByRole";
import { normalizeRole } from "../utils/normalizeRole";
import { useTheme } from "../utils/theme.jsx";
import { useSystemSettings } from "../utils/systemSettings.jsx";

function NavIcon({ name }) {
  const { settings } = useSystemSettings();
  const icons = {
    home: "🏠",
    admin: "🛡️",
    hr: "👥",
    payroll: "💳",
    doctor: "🧑‍⚕️",
    nurse: "👩‍⚕️",
    lab: "🧪",
    pharmacy: "💊",
    staff: "🧑‍💼",
    security: "🔐",
    settings: "⚙️",
    analytics: "📊",
    reports: "📄",
    notifications: "🔔",
    requests: "📝",
    inventory: "📦",
    ai: "🤖",
    appointments: "📅",
  };

  const custom = settings?.branding?.sidebarIcons?.[name];

  return (
    <span className="nav-icon" aria-hidden="true">
      {custom ? <img className="nav-icon-img" src={custom} alt="" /> : icons[name] || "•"}
    </span>
  );
}

export default function Sidebar({ open = true, onClose }) {
  const { user, logout } = useAuth();
  const { can } = useCan();
  const { theme, setTheme } = useTheme();
  const { settings } = useSystemSettings();
  const navigate = useNavigate();
  const [dynamicMenu, setDynamicMenu] = useState([]);
  const [menuLoaded, setMenuLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("token");
    if (!token) return;

    fetchMenu()
      .then((res) => {
        setDynamicMenu(res.menu || []);
        setMenuLoaded(true);
      })
      .catch(() => {
        setDynamicMenu([]);
        setMenuLoaded(true);
      });
  }, [user]);

  if (!user) return null;

  const homePath = redirectByRole(user);
  const normalizedRole = normalizeRole(user.role);
  const canSelfService = !["SUPER_ADMIN", "SYSTEM_ADMIN", "GUEST", "PATIENT"].includes(
    normalizedRole
  );

  const UnverifiedBadge = () =>
    !user.emailVerified ? <span className="badge-dot">!</span> : null;

  if (user.role === "GUEST") {
    return (
      <aside
        className={`sidebar ${open ? "" : "collapsed"}`}
        onWheel={(e) => e.stopPropagation()}
      >
        <div className="sidebar-header sticky">
          <div className="brand-mark">
            {settings?.branding?.logo ? (
              <span
                className="brand-logo"
                style={{ backgroundImage: `url(${settings.branding.logo})` }}
              />
            ) : (
              "AfyaLink"
            )}
          </div>
          <div className="brand-sub">Demo Workspace</div>
        </div>
        <div className="sidebar-scroll">
          <nav>
            <ul>
              <li>
                <button
                  className="nav-btn"
                  onClick={() => {
                    navigate("/guest");
                    onClose?.();
                  }}
                >
                  <NavIcon name="home" />
                  Demo Home
                </button>
              </li>

              <Section title="Demo">
                {can("ai", "chat") && (
                  <Item
                    to="/ai/chatbot"
                    icon="ai"
                    onSelect={onClose}
                  >
                    AI Chatbot
                  </Item>
                )}
                {can("ai", "medical") && (
                  <Item
                    to="/ai/medical"
                    icon="ai"
                    onSelect={onClose}
                  >
                    AI Assistant
                  </Item>
                )}
              </Section>
            </ul>
          </nav>
        </div>

        <div className="sidebar-footer sticky-footer">
          <div className="footer-actions">
            <button className="nav-btn" onClick={() => { navigate("/reports"); onClose?.(); }}>
              <NavIcon name="reports" />
              Help
            </button>
            <button className="nav-btn" onClick={() => { navigate("/profile"); onClose?.(); }}>
              <NavIcon name="settings" />
              Settings
            </button>
            <button className="nav-btn" onClick={() => { logout(); onClose?.(); }}>
              <NavIcon name="security" />
              Sign Out
            </button>
          </div>
          <div>AfyaLink • Demo Mode</div>
        </div>
      </aside>
    );
  }


  return (
    <aside
      className={`sidebar ${open ? "" : "collapsed"}`}
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="sidebar-header sticky">
        <div className="brand-mark">
          {settings?.branding?.logo ? (
            <span
              className="brand-logo"
              style={{ backgroundImage: `url(${settings.branding.logo})` }}
            />
          ) : (
            "AfyaLink"
          )}
        </div>
        <div className="brand-sub">{user.role} Workspace</div>
      </div>
      <div className="sidebar-scroll">
        <nav>
          <ul>
            {menuLoaded &&
              dynamicMenu.length > 0 &&
              dynamicMenu.map((section) => (
                <Section key={section.section} title={section.section}>
                  {section.items.map((item, idx) =>
                    item.path ? (
                      <Item
                        key={item.path || `${section.section}-${idx}`}
                        to={item.path}
                        icon={item.icon || "admin"}
                        onSelect={onClose}
                      >
                        {item.label}
                      </Item>
                    ) : (
                      <li key={`${section.section}-${idx}`} className="nav-static">
                        <span className="nav-btn">
                          <NavIcon name={item.icon || "admin"} />
                          {item.label}
                        </span>
                      </li>
                    )
                  )}
                </Section>
              ))}

            {menuLoaded && dynamicMenu.length === 0 && (
              <>
                {["SUPER_ADMIN", "DEVELOPER"].includes(normalizedRole) && (
                  <Section title="All Dashboards">
                    <Item to="/super-admin" icon="admin" onSelect={onClose}>
                      Super Admin
                    </Item>
                    <Item to="/system-admin" icon="admin" onSelect={onClose}>
                      System Admin
                    </Item>
                    <Item to="/hospital-admin" icon="admin" onSelect={onClose}>
                      Hospital Admin
                    </Item>
                    <Item to="/hr-manager" icon="hr" onSelect={onClose}>
                      HR Manager
                    </Item>
                    <Item to="/payroll-officer" icon="payroll" onSelect={onClose}>
                      Payroll Officer
                    </Item>
                    <Item to="/doctor" icon="doctor" onSelect={onClose}>
                      Doctor
                    </Item>
                    <Item to="/nurse" icon="nurse" onSelect={onClose}>
                      Nurse
                    </Item>
                    <Item to="/lab-tech" icon="lab" onSelect={onClose}>
                      Lab Tech
                    </Item>
                    <Item to="/pharmacy" icon="pharmacy" onSelect={onClose}>
                      Pharmacist
                    </Item>
                    <Item to="/staff" icon="staff" onSelect={onClose}>
                      Staff (Radiology/Therapy/Reception)
                    </Item>
                    <Item to="/security-admin" icon="security" onSelect={onClose}>
                      Security Admin
                    </Item>
                    <Item to="/security-officer" icon="security" onSelect={onClose}>
                      Security Officer
                    </Item>
                    <Item to="/developer" icon="settings" onSelect={onClose}>
                      Developer Console
                    </Item>
                    <Item
                      to="/developer/queue-replay"
                      icon="settings"
                      onSelect={onClose}
                    >
                      Queue Replay
                    </Item>
                    <Item
                      to="/developer/webhook-retry"
                      icon="settings"
                      onSelect={onClose}
                    >
                      Webhook Retry
                    </Item>
                    <Item
                      to="/developer/decision-cockpit"
                      icon="analytics"
                      onSelect={onClose}
                    >
                      Decision Cockpit
                    </Item>
                    <Item
                      to="/developer/provenance-verify"
                      icon="security"
                      onSelect={onClose}
                    >
                      Provenance Verify
                    </Item>
                    <Item
                      to="/developer/ai-extraction-history"
                      icon="ai"
                      onSelect={onClose}
                    >
                      AI Extraction History
                    </Item>
                  </Section>
                )}

                <Section title="Home">
                  <Item to="/analytics" icon="analytics" onSelect={onClose}>
                    Insights
                  </Item>
                  <Item to="/reports" icon="reports" onSelect={onClose}>
                    Reports
                  </Item>
                  {normalizedRole === "SYSTEM_ADMIN" && (
                    <Item to="/system-admin" icon="admin" onSelect={onClose}>
                      System Admin
                    </Item>
                  )}
                  {["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"].includes(normalizeRole(user.role)) && (
                    <Item to="/system-admin/abac" icon="security" onSelect={onClose}>
                      ABAC Policies
                    </Item>
                  )}
                  {["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"].includes(normalizeRole(user.role)) && (
                    <Item to="/system-admin/mapping-studio" icon="settings" onSelect={onClose}>
                      Mapping Studio
                    </Item>
                  )}
                  {["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "HR_MANAGER", "PAYROLL_OFFICER"].includes(normalizeRole(user.role)) && (
                    <Item to="/system-admin/nlp-analytics" icon="analytics" onSelect={onClose}>
                      NLP Analytics
                    </Item>
                  )}
                  {["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN", "HR_MANAGER", "DOCTOR", "NURSE"].includes(normalizeRole(user.role)) && (
                    <Item to="/system-admin/clinical-intelligence" icon="ai" onSelect={onClose}>
                      Clinical Intelligence
                    </Item>
                  )}
                  {["SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN"].includes(normalizeRole(user.role)) && (
                    <Item to="/system-admin/regulatory-reports" icon="reports" onSelect={onClose}>
                      Regulatory Reports
                    </Item>
                  )}
                  {normalizedRole === "DEVELOPER" && (
                    <Item to="/developer" icon="settings" onSelect={onClose}>
                      Developer Console
                    </Item>
                  )}
                  {["SUPER_ADMIN", "SYSTEM_ADMIN"].includes(
                    normalizeRole(user.role)
                  ) && (
                    <Item
                      to="/super-admin/hospitals"
                      icon="admin"
                      onSelect={onClose}
                    >
                      Manage Hospitals
                    </Item>
                  )}
                </Section>

              <Section title="Human Resources">
                <Item to="/hospital-admin" icon="admin" onSelect={onClose}>
                  Hospital Admin
                </Item>
                <Item
                  to="/hospital-admin/register-staff"
                  icon="staff"
                  onSelect={onClose}
                >
                  Register Staff
                </Item>
                <Item
                  to="/hospital-admin/approvals"
                  icon="notifications"
                  onSelect={onClose}
                >
                  Approvals
                </Item>
                <Item
                  to="/hospital-admin/staff"
                  icon="staff"
                  onSelect={onClose}
                >
                  Staff Management
                </Item>
                {canSelfService && (
                  <Item
                    to="/workforce/requests"
                    icon="requests"
                    onSelect={onClose}
                  >
                    My Requests
                  </Item>
                )}
                <Item to="/staff" icon="staff" onSelect={onClose}>
                  Staff Workspace
                </Item>
                <Item to="/hr-manager" icon="hr" onSelect={onClose}>
                  HR Manager
                </Item>
                {can("inventory", "read") && (
                  <Item to="/inventory" icon="inventory" onSelect={onClose}>
                    Inventory
                  </Item>
                )}
                {can("pharmacy", "read") && (
                  <Item to="/pharmacy" icon="pharmacy" onSelect={onClose}>
                    Pharmacy
                  </Item>
                )}
              </Section>

              <Section title="Talent">
                <Item to="/admin/create-admin" icon="admin" onSelect={onClose}>
                  Admin Access
                </Item>
                <Item to="/admin/audit-logs" icon="admin" onSelect={onClose}>
                  Audit Logs
                </Item>
                <Item to="/admin/notifications" icon="notifications" onSelect={onClose}>
                  Notifications
                </Item>
              </Section>

              <Section title="Workforce">
                <Item to="/doctor" icon="doctor" onSelect={onClose}>
                  Clinician Dashboard
                </Item>
                <Item to="/nurse" icon="nurse" onSelect={onClose}>
                  Nursing Dashboard
                </Item>
                <Item to="/lab-tech" icon="lab" onSelect={onClose}>
                  Lab Dashboard
                </Item>
                <Item to="/labtech/labs" icon="lab" onSelect={onClose}>
                  Lab Tests
                </Item>
                <Item to="/doctor/appointments" icon="appointments" onSelect={onClose}>
                  Appointments
                </Item>
              </Section>

              {normalizedRole === "DOCTOR" && (
                <Section title="Doctor Workspace">
                  <Item to="/doctor/schedule" icon="appointments" onSelect={onClose}>
                    My Schedule
                  </Item>
                  <Item to="/doctor/patients" icon="doctor" onSelect={onClose}>
                    My Patients
                  </Item>
                  <Item to="/doctor/opd" icon="doctor" onSelect={onClose}>
                    OPD Clinic
                  </Item>
                  <Item to="/doctor/ward" icon="staff" onSelect={onClose}>
                    Inpatient Ward
                  </Item>
                  <Item to="/doctor/surgery" icon="reports" onSelect={onClose}>
                    Surgery / Procedures
                  </Item>
                  <Item to="/doctor/lab-results" icon="lab" onSelect={onClose}>
                    Lab Results
                  </Item>
                  <Item to="/doctor/prescriptions" icon="pharmacy" onSelect={onClose}>
                    Prescriptions
                  </Item>
                  <Item to="/doctor/medical-records" icon="reports" onSelect={onClose}>
                    Medical Records
                  </Item>
                  <Item to="/doctor/referrals" icon="reports" onSelect={onClose}>
                    Referrals
                  </Item>
                  <Item to="/doctor/performance" icon="analytics" onSelect={onClose}>
                    Performance
                  </Item>
                  <Item to="/doctor/cme" icon="doctor" onSelect={onClose}>
                    CME & Certifications
                  </Item>
                  <Item to="/doctor/leave" icon="requests" onSelect={onClose}>
                    Leave Requests
                  </Item>
                  <Item to="/doctor/reports-notes" icon="reports" onSelect={onClose}>
                    Reports & Notes
                  </Item>
                  <Item to="/doctor/settings" icon="settings" onSelect={onClose}>
                    Settings
                  </Item>
                </Section>
              )}

              {normalizedRole === "NURSE" && (
                <Section title="Nurse Workspace">
                  <Item to="/nurse/shift" icon="nurse" onSelect={onClose}>My Shift</Item>
                  <Item to="/nurse/patients" icon="staff" onSelect={onClose}>Assigned Patients</Item>
                  <Item to="/nurse/medication" icon="nurse" onSelect={onClose}>Medication Administration</Item>
                  <Item to="/nurse/incidents" icon="notifications" onSelect={onClose}>Incident Reports</Item>
                  <Item to="/nurse/vitals" icon="reports" onSelect={onClose}>Vitals Entry</Item>
                  <Item to="/nurse/leave" icon="requests" onSelect={onClose}>Leave Requests</Item>
                  <Item to="/nurse/performance" icon="analytics" onSelect={onClose}>Performance</Item>
                </Section>
              )}

              {normalizedRole === "LAB_TECH" && (
                <Section title="Lab Workspace">
                  <Item to="/lab-tech/test-queue" icon="lab" onSelect={onClose}>Test Queue</Item>
                  <Item to="/lab-tech/equipment" icon="lab" onSelect={onClose}>Equipment Logs</Item>
                  <Item to="/lab-tech/samples" icon="lab" onSelect={onClose}>Sample Tracking</Item>
                  <Item to="/lab-tech/qc" icon="analytics" onSelect={onClose}>Quality Control</Item>
                  <Item to="/lab-tech/safety" icon="security" onSelect={onClose}>Safety Checklist</Item>
                  <Item to="/lab-tech/archive" icon="reports" onSelect={onClose}>Reports Archive</Item>
                </Section>
              )}

              {normalizedRole === "PHARMACIST" && (
                <Section title="Pharmacy Workspace">
                  <Item to="/pharmacy/queue" icon="pharmacy" onSelect={onClose}>Prescription Queue</Item>
                  <Item to="/pharmacy/inventory" icon="inventory" onSelect={onClose}>Inventory</Item>
                  <Item to="/pharmacy/controlled" icon="security" onSelect={onClose}>Controlled Drugs</Item>
                  <Item to="/pharmacy/expiry" icon="notifications" onSelect={onClose}>Expiry Alerts</Item>
                  <Item to="/pharmacy/suppliers" icon="reports" onSelect={onClose}>Supplier Orders</Item>
                  <Item to="/pharmacy/reports" icon="reports" onSelect={onClose}>Reports</Item>
                </Section>
              )}

              {normalizedRole === "PATIENT" && (
                <Section title="Patient Workspace">
                  <Item to="/patient/appointments" icon="appointments" onSelect={onClose}>My Appointments</Item>
                  <Item to="/patient/medical-records" icon="reports" onSelect={onClose}>Medical Records</Item>
                  <Item to="/patient/prescriptions" icon="pharmacy" onSelect={onClose}>Prescriptions</Item>
                  <Item to="/patient/lab-results" icon="lab" onSelect={onClose}>Lab Results</Item>
                  <Item to="/patient/billing" icon="payroll" onSelect={onClose}>Billing</Item>
                  <Item to="/patient/insurance" icon="reports" onSelect={onClose}>Insurance</Item>
                  <Item to="/patient/feedback" icon="notifications" onSelect={onClose}>Feedback</Item>
                </Section>
              )}

              <Section title="Payroll & Finance">
                <Item to="/payments" icon="payroll" onSelect={onClose}>
                  Payroll & Payments
                </Item>
                <Item to="/payments/full" icon="payroll" onSelect={onClose}>
                  Payment Operations
                </Item>
                {normalizeRole(user.role) === "SUPER_ADMIN" && (
                  <Item to="/admin/payment-settings" icon="payroll" onSelect={onClose}>
                    Payment Settings
                  </Item>
                )}
                <Item to="/payroll-officer" icon="payroll" onSelect={onClose}>
                  Payroll Officer
                </Item>
              </Section>

              <Section title="AI & Automation">
                <Item to="/ai/medical" icon="ai" onSelect={onClose}>
                  Clinical Assistant
                </Item>
                <Item to="/ai/triage" icon="ai" onSelect={onClose}>
                  Triage
                </Item>
                <Item to="/ai/voice" icon="ai" onSelect={onClose}>
                  Voice Dictation
                </Item>
                <Item to="/ai/extract" icon="ai" onSelect={onClose}>
                  NeuroEdge Extract
                </Item>
                <Item to="/ai/chatbot" icon="ai" onSelect={onClose}>
                  Support Chat
                </Item>
                <Item to="/ai/ws" icon="ai" onSelect={onClose}>
                  Live AI Chat
                </Item>
              </Section>

              <Section title="Security & Setup">
                <Item to="/security-admin" icon="security" onSelect={onClose}>
                  Security Admin
                </Item>
                <Item to="/security-officer" icon="security" onSelect={onClose}>
                  Security Officer
                </Item>
                <Item to="/admin/realtime" icon="settings" onSelect={onClose}>
                  Integrations
                </Item>
                <Item to="/admin/crdt-patients" icon="settings" onSelect={onClose}>
                  Offline Sync
                </Item>
              </Section>

              <Section title="Quick Actions">
                {getQuickActions(normalizeRole(user.role)).map((a) => (
                  <Item key={a.path} to={a.path} icon="home" onSelect={onClose}>
                    {a.label}
                  </Item>
                ))}
              </Section>

                <Section title="Settings">
                  {["SUPER_ADMIN", "DEVELOPER"].includes(normalizeRole(user.role)) && (
                    <Item to="/super-admin/settings" icon="settings" onSelect={onClose}>
                      System Settings
                    </Item>
                  )}
                  <Item to="/profile" icon="settings" onSelect={onClose}>
                    Account Settings
                  </Item>
                  <Item to="/reports" icon="reports" onSelect={onClose}>
                    Help & Policies
                  </Item>
                  <Item to="/admin/audit-logs" icon="admin" onSelect={onClose}>
                    Activity Log
                  </Item>
                  <li className="theme-row">
                    <button
                      className={`nav-btn ${theme === "light" ? "active" : ""}`}
                      onClick={() => setTheme("light")}
                    >
                      <NavIcon name="settings" />
                      Light
                    </button>
                    <button
                      className={`nav-btn ${theme === "dark" ? "active" : ""}`}
                      onClick={() => setTheme("dark")}
                    >
                      <NavIcon name="settings" />
                      Dark
                    </button>
                    <button
                      className={`nav-btn ${theme === "system" ? "active" : ""}`}
                      onClick={() => setTheme("system")}
                    >
                      <NavIcon name="settings" />
                      System
                    </button>
                  </li>
                </Section>
              </>
            )}

          </ul>
        </nav>
      </div>

      <div className="sidebar-footer sticky-footer">
        <div className="footer-actions">
          <button className="nav-btn" onClick={() => { navigate("/reports"); onClose?.(); }}>
            <NavIcon name="reports" />
            Help
          </button>
          <button className="nav-btn" onClick={() => { navigate("/profile"); onClose?.(); }}>
            <NavIcon name="settings" />
            Settings
          </button>
          <button className="nav-btn" onClick={() => { logout(); onClose?.(); }}>
            <NavIcon name="security" />
            Sign Out
          </button>
        </div>
        <div>AfyaLink • Secure</div>
      </div>
    </aside>
  );
}

function Section({ title, children }) {
  return (
    <>
      <li className="section-title">{title}</li>
      {children}
    </>
  );
}

function Item({ to, children, icon, onSelect }) {
  const navigate = useNavigate();
  return (
    <li>
      <button
        className="nav-btn"
        onClick={() => {
          navigate(to);
          onSelect?.();
        }}
      >
        <NavIcon name={icon} />
        {children}
      </button>
    </li>
  );
}

function getQuickActions(role) {
  const requestActions = [
    { label: "Request Leave", path: "/workforce/requests#leave" },
    { label: "Request Overtime", path: "/workforce/requests#overtime" },
    { label: "Request Shift", path: "/workforce/requests#shift" },
  ];

  const common = [
    { label: "View Notifications", path: "/admin/notifications" },
    { label: "Open Reports", path: "/reports" },
  ];

  const roleActions = {
    SUPER_ADMIN: [
      { label: "Manage Hospitals", path: "/super-admin/hospitals" },
      { label: "Create Admin", path: "/admin/create-admin" },
      { label: "Audit Logs", path: "/admin/audit-logs" },
      { label: "SLA Policies", path: "/hospital-admin/approvals#sla" },
      { label: "Queue Insights", path: "/hospital-admin/approvals" },
    ],
    SYSTEM_ADMIN: [
      { label: "Manage Hospitals", path: "/super-admin/hospitals" },
      { label: "Audit Logs", path: "/admin/audit-logs" },
      { label: "SLA Policies", path: "/hospital-admin/approvals#sla" },
      { label: "Queue Insights", path: "/hospital-admin/approvals" },
    ],
    HOSPITAL_ADMIN: [
      { label: "Open Approvals", path: "/hospital-admin" },
      { label: "Inventory Review", path: "/inventory" },
      { label: "SLA Policies", path: "/hospital-admin/approvals#sla" },
    ],
    HR_MANAGER: [
      { label: "Recruitment Pipeline", path: "/hr-manager" },
      { label: "Performance Reviews", path: "/hr-manager" },
    ],
    PAYROLL_OFFICER: [
      { label: "Run Payroll", path: "/payroll-officer" },
      { label: "Payment Operations", path: "/payments/full" },
    ],
    DOCTOR: [
      { label: "Start Consult", path: "/doctor" },
      { label: "Appointments", path: "/doctor/appointments" },
    ],
    NURSE: [
      { label: "Start Round", path: "/nurse" },
      { label: "Patient Tasks", path: "/nurse" },
    ],
    LAB_TECH: [
      { label: "Lab Queue", path: "/lab-tech" },
      { label: "Lab Tests", path: "/labtech/labs" },
    ],
    PHARMACIST: [
      { label: "Dispense Queue", path: "/pharmacy" },
      { label: "Inventory", path: "/inventory" },
    ],
    RADIOLOGIST: [],
    THERAPIST: [],
    RECEPTIONIST: [],
    DEVELOPER: [
      { label: "Integration Console", path: "/developer" },
      { label: "SLA Policies", path: "/hospital-admin/approvals#sla" },
      { label: "Queue Insights", path: "/hospital-admin/approvals" },
    ],
    PATIENT: [
      { label: "Book Appointment", path: "/patient" },
      { label: "Payments", path: "/payments" },
    ],
  };

  const includeRequests = [
    "HOSPITAL_ADMIN",
    "HR_MANAGER",
    "PAYROLL_OFFICER",
    "DOCTOR",
    "NURSE",
    "LAB_TECH",
    "PHARMACIST",
    "RADIOLOGIST",
    "THERAPIST",
    "RECEPTIONIST",
    "SECURITY_ADMIN",
    "SECURITY_OFFICER",
  ].includes(role);

  return [
    ...(roleActions[role] || []),
    ...(includeRequests ? requestActions : []),
    ...common,
  ];
}
