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

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

async function optimizeImageDataUrl(file, { maxDimension = 1600, targetBytes = 900 * 1024 } = {}) {
  if (!file?.type?.startsWith("image/")) return fileToDataUrl(file);
  if (file.type === "image/svg+xml") return fileToDataUrl(file);

  const rawDataUrl = await fileToDataUrl(file);
  if (file.size <= targetBytes) return rawDataUrl;

  const img = await loadImageFromDataUrl(rawDataUrl);
  const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));

  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  let quality = 0.86;
  let compressed = canvas.toDataURL("image/webp", quality);

  while (compressed.length > targetBytes * 1.37 && quality > 0.45) {
    quality -= 0.08;
    compressed = canvas.toDataURL("image/webp", quality);
  }

  return compressed;
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
  const [savingCard, setSavingCard] = useState("");
  const [msg, setMsg] = useState(null);
  const [initialForm, setInitialForm] = useState(null);

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
        setInitialForm(next);
      })
      .catch(() => {});
  }, []);

  const isObject = (value) =>
    value && typeof value === "object" && !Array.isArray(value);

  const deepEqual = (a, b) => {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (!isObject(a) || !isObject(b)) return false;
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    for (const key of aKeys) {
      if (!deepEqual(a[key], b[key])) return false;
    }
    return true;
  };

  const buildPatch = (current, original) => {
    if (!original) return current;
    const patch = {};
    for (const key of Object.keys(current || {})) {
      const currVal = current[key];
      const origVal = original?.[key];
      if (isObject(currVal) && isObject(origVal)) {
        const childPatch = buildPatch(currVal, origVal);
        if (Object.keys(childPatch).length) patch[key] = childPatch;
        continue;
      }
      if (!deepEqual(currVal, origVal)) patch[key] = currVal;
    }
    return patch;
  };

  const persistPatch = async (patch, successMessage = "Settings saved.") => {
    setLoading(true);
    setMsg(null);
    try {
      if (!Object.keys(patch).length) {
        setMsg("No changes to save.");
        return;
      }
      const res = await updateSystemSettings(patch);
      setMsg(successMessage);
      if (res.settings) {
        setSettings(res.settings);
        setInitialForm(res.settings);
        setForm({
          branding: { ...form.branding, ...(res.settings.branding || {}) },
          ai: { ...form.ai, ...(res.settings.ai || {}) },
          monetization: {
            ...form.monetization,
            ...(res.settings.monetization || {}),
            featureAccess: {
              ...(form.monetization.featureAccess || {}),
              ...(res.settings?.monetization?.featureAccess || {}),
            },
          },
        });
      }
    } catch (err) {
      setMsg(err?.message || "Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    const patch = buildPatch(form, initialForm);
    await persistPatch(patch, "All settings saved.");
  };

  const saveCard = async (key) => {
    const map = {
      branding: { branding: form.branding },
      monetization: { monetization: form.monetization },
      ai: { ai: form.ai },
    };
    if (!map[key]) return;
    setSavingCard(key);
    await persistPatch(map[key], `${key.charAt(0).toUpperCase()}${key.slice(1)} settings saved.`);
    setSavingCard("");
  };

  const handleFile = async (key, file) => {
    if (!file) return;
    const dataUrl = await optimizeImageDataUrl(file);
    setForm((f) => ({
      ...f,
      branding: { ...f.branding, [key]: dataUrl },
    }));
  };

  const handleSidebarIcon = async (key, file) => {
    if (!file) return;
    const dataUrl = await optimizeImageDataUrl(file, {
      maxDimension: 512,
      targetBytes: 250 * 1024,
    });
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
            {loading ? "Saving..." : "Save All Settings"}
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
          <button
            type="button"
            className="btn-primary"
            onClick={() => saveCard("branding")}
            disabled={loading || savingCard === "branding"}
          >
            {savingCard === "branding" ? "Saving..." : "Save Branding"}
          </button>
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
          <button
            type="button"
            className="btn-primary"
            onClick={() => saveCard("branding")}
            disabled={loading || savingCard === "branding"}
          >
            {savingCard === "branding" ? "Saving..." : "Save Sidebar Icons"}
          </button>
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
          <button
            type="button"
            className="btn-primary"
            onClick={() => saveCard("monetization")}
            disabled={loading || savingCard === "monetization"}
          >
            {savingCard === "monetization" ? "Saving..." : "Save Free/Premium Policy"}
          </button>
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
          <button
            type="button"
            className="btn-primary"
            onClick={() => saveCard("ai")}
            disabled={loading || savingCard === "ai"}
          >
            {savingCard === "ai" ? "Saving..." : "Save AI Settings"}
          </button>
        </div>
      </section>
    </div>
  );
}
