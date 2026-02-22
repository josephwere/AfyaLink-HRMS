import React, { useEffect, useState } from "react";
import { useAuth } from "../../utils/auth";
import { getSystemSettings, updateSystemSettings } from "../../services/systemSettingsApi";
import { useSystemSettings } from "../../utils/systemSettings.jsx";

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function SystemSettings() {
  const { user } = useAuth();
  const { settings, setSettings } = useSystemSettings();
  const [form, setForm] = useState({
    branding: {
      appIcon: "",
      favicon: "",
      logo: "",
      loginBackground: "",
      homeBackground: "",
      sidebarIcons: {},
    },
    ai: {
      enabled: false,
      name: "NeuroEdge",
      url: "",
      greeting: "Hi, how can I help?",
    },
    monetization: {
      strategy: "CORE_FREE_PREMIUM_ADDONS",
      enforceUsageLimits: false,
      featureAccess: {
        ai: "PREMIUM",
        payments: "FREE",
        pharmacy: "FREE",
        inventory: "FREE",
        lab: "FREE",
        realtime: "PREMIUM",
        auditLogs: "PREMIUM",
        adminCreation: "FREE",
        advertising: "PREMIUM",
        recruitmentAds: "PREMIUM",
        advancedAnalytics: "PREMIUM",
        heavyExports: "PREMIUM",
      },
    },
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  if (!["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(user?.role)) {
    return <p>🚫 Access denied</p>;
  }

  useEffect(() => {
    getSystemSettings()
      .then((data) => {
        const next = {
          branding: { ...form.branding, ...(data.branding || {}) },
          ai: { ...form.ai, ...(data.ai || {}) },
          monetization: {
            ...form.monetization,
            ...(data.monetization || {}),
            featureAccess: {
              ...(form.monetization.featureAccess || {}),
              ...(data?.monetization?.featureAccess || {}),
            },
          },
        };
        setForm(next);
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await updateSystemSettings(form);
      setMsg("✅ Settings saved");
      if (res.settings) setSettings(res.settings);
    } catch (err) {
      setMsg(err?.message || "Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  const handleFile = async (key, file) => {
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setForm((f) => ({
      ...f,
      branding: { ...f.branding, [key]: dataUrl },
    }));
  };

  const handleSidebarIcon = async (key, file) => {
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setForm((f) => ({
      ...f,
      branding: {
        ...f.branding,
        sidebarIcons: { ...(f.branding.sidebarIcons || {}), [key]: dataUrl },
      },
    }));
  };

  const sidebarIconList = [
    { key: "home", label: "Home" },
    { key: "admin", label: "Admin" },
    { key: "hr", label: "HR" },
    { key: "payroll", label: "Payroll" },
    { key: "doctor", label: "Doctor" },
    { key: "nurse", label: "Nurse" },
    { key: "lab", label: "Lab" },
    { key: "pharmacy", label: "Pharmacy" },
    { key: "staff", label: "Staff" },
    { key: "security", label: "Security" },
    { key: "settings", label: "Settings" },
    { key: "analytics", label: "Analytics" },
    { key: "reports", label: "Reports" },
    { key: "notifications", label: "Notifications" },
    { key: "requests", label: "Requests" },
    { key: "inventory", label: "Inventory" },
    { key: "ai", label: "AI" },
    { key: "appointments", label: "Appointments" },
  ];

  const monetizationFeatures = [
    { key: "ai", label: "AI Assistant & Automation" },
    { key: "payments", label: "Payments Core" },
    { key: "pharmacy", label: "Pharmacy Module" },
    { key: "inventory", label: "Inventory Module" },
    { key: "lab", label: "Laboratory Module" },
    { key: "realtime", label: "Realtime Integrations" },
    { key: "auditLogs", label: "Audit Logs & Compliance Tools" },
    { key: "adminCreation", label: "Admin Creation Tools" },
    { key: "advertising", label: "Hospital Advertising Placements" },
    { key: "recruitmentAds", label: "Recruitment Ad Marketplace" },
    { key: "advancedAnalytics", label: "Advanced Analytics" },
    { key: "heavyExports", label: "Heavy Data Export Jobs" },
  ];

  const setAllFeatureAccess = (tier) => {
    setForm((f) => ({
      ...f,
      monetization: {
        ...f.monetization,
        featureAccess: Object.fromEntries(
          monetizationFeatures.map((item) => [item.key, tier])
        ),
      },
    }));
  };

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>System Settings</h2>
          <p className="muted">Branding, payments, and AI configuration.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-primary" onClick={save} disabled={loading}>
            {loading ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>

      {msg && <div className="card">{msg}</div>}

      <section className="section">
        <h3>Branding Assets</h3>
        <div className="card form">
          <label>Main App Icon</label>
          <input type="file" accept="image/*" onChange={(e) => handleFile("appIcon", e.target.files?.[0])} />
          <label>Favicon (.ico or png)</label>
          <input type="file" accept="image/*" onChange={(e) => handleFile("favicon", e.target.files?.[0])} />
          <label>Logo (Navbar/Sidebar)</label>
          <input type="file" accept="image/*" onChange={(e) => handleFile("logo", e.target.files?.[0])} />
          <label>Login Background Image</label>
          <input type="file" accept="image/*" onChange={(e) => handleFile("loginBackground", e.target.files?.[0])} />
          <label>Home Background Image</label>
          <input type="file" accept="image/*" onChange={(e) => handleFile("homeBackground", e.target.files?.[0])} />
        </div>
      </section>

      <section className="section">
        <h3>Sidebar Icons</h3>
        <div className="card form">
          {sidebarIconList.map((item) => (
            <div key={item.key} className="icon-upload-row">
              <label>{item.label} Icon</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleSidebarIcon(item.key, e.target.files?.[0])}
              />
              {form.branding.sidebarIcons?.[item.key] && (
                <img
                  src={form.branding.sidebarIcons[item.key]}
                  alt={`${item.label} icon`}
                  className="icon-preview"
                />
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h3>Payments</h3>
        <div className="card">
          <p className="muted">
            Use the Payment Settings page to set Stripe, Mpesa, Flutterwave, and card settings.
          </p>
          <a className="action-link" href="/admin/payment-settings">
            Open Payment Settings
          </a>
        </div>
      </section>

      <section className="section">
        <h3>Free vs Premium Policy Control</h3>
        <div className="card form">
          <p className="muted">
            Core model: patients always free, hospitals use core modules free. Premium only applies to features you mark as PREMIUM.
          </p>
          <label>
            <input
              type="checkbox"
              checked={Boolean(form.monetization.enforceUsageLimits)}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  monetization: {
                    ...f.monetization,
                    enforceUsageLimits: e.target.checked,
                  },
                }))
              }
            />
            Enforce plan usage limits (users/patients/storage)
          </label>
          <div className="action-list" style={{ marginBottom: 8 }}>
            <button type="button" className="btn-secondary" onClick={() => setAllFeatureAccess("FREE")}>
              Set All Free
            </button>
            <button type="button" className="btn-secondary" onClick={() => setAllFeatureAccess("PREMIUM")}>
              Set All Premium
            </button>
          </div>
          {monetizationFeatures.map((item) => (
            <div key={item.key} className="profile-row profile-actions-row">
              <label style={{ flex: 1 }}>{item.label}</label>
              <select
                value={form.monetization.featureAccess?.[item.key] || "FREE"}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    monetization: {
                      ...f.monetization,
                      featureAccess: {
                        ...(f.monetization.featureAccess || {}),
                        [item.key]: e.target.value,
                      },
                    },
                  }))
                }
              >
                <option value="FREE">FREE</option>
                <option value="PREMIUM">PREMIUM</option>
              </select>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h3>NeuroEdge AI</h3>
        <div className="card form">
          <label>
            <input
              type="checkbox"
              checked={form.ai.enabled}
              onChange={(e) =>
                setForm((f) => ({ ...f, ai: { ...f.ai, enabled: e.target.checked } }))
              }
            />
            Enable Floating AI
          </label>
          <label>AI Name</label>
          <input
            value={form.ai.name}
            onChange={(e) =>
              setForm((f) => ({ ...f, ai: { ...f.ai, name: e.target.value } }))
            }
          />
          <label>AI URL</label>
          <input
            placeholder="https://neuroedge.ai/chat"
            value={form.ai.url}
            onChange={(e) =>
              setForm((f) => ({ ...f, ai: { ...f.ai, url: e.target.value } }))
            }
          />
          <label>Greeting</label>
          <input
            value={form.ai.greeting}
            onChange={(e) =>
              setForm((f) => ({ ...f, ai: { ...f.ai, greeting: e.target.value } }))
            }
          />
        </div>
      </section>
    </div>
  );
}
