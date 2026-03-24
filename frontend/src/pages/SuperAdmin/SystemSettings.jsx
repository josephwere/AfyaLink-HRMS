import React, { useEffect, useState } from "react";
import { useAuth } from "../../utils/auth";
import {
  getEmailDeliveryHealth,
  getSystemSettings,
  updateSystemSettings,
} from "../../services/systemSettingsApi";
import { useSystemSettings } from "../../utils/systemSettings.jsx";
import { normalizeRole } from "../../utils/normalizeRole";
import AccessDeniedCard from "../../components/AccessDeniedCard";

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
  const actorRole = normalizeRole(user?.actualRole || user?.role);
  const { settings, setSettings, lastSyncedAt, pushConnected } = useSystemSettings();
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
      enabled: true,
      icon: "",
      name: "NeuroEdge",
      url: "",
      greeting: "Hi, how can I help?",
    },
    communications: {
      callsEnabled: true,
      videoCallsEnabled: true,
      voiceCallsEnabled: true,
    },
    clinical: {
      closeoutPolicy: {
        requireDiagnosisBeforeClose: true,
        requireBillingHandoffWhenPaymentsEnabled: true,
        requirePrescriptionWhenPharmacyEnabled: false,
      },
      familyAccess: {
        requireOtpForFamilyAnchor: true,
        allowSingleAnchorForSpouseAndChildren: true,
        otpTtlSeconds: 600,
        countryPolicies: {
          DEFAULT: { fullProxyMaxAge: 15, sharedAccessMinAge: 16, adultAge: 18, label: "Default", enabled: true },
          KE: { fullProxyMaxAge: 15, sharedAccessMinAge: 16, adultAge: 18, label: "Kenya", enabled: true },
          UG: { fullProxyMaxAge: 15, sharedAccessMinAge: 16, adultAge: 18, label: "Uganda", enabled: true },
          TZ: { fullProxyMaxAge: 15, sharedAccessMinAge: 16, adultAge: 18, label: "Tanzania", enabled: true },
        },
      },
    },
    monetization: {
      strategy: "CORE_FREE_PREMIUM_ADDONS",
      enforceUsageLimits: false,
      featureAccess: {
        ai: "FREE",
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
  const [emailHealth, setEmailHealth] = useState(null);
  const [emailHealthLoading, setEmailHealthLoading] = useState(false);

  if (!["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(actorRole)) {
    return <AccessDeniedCard message="System settings require founder, system admin, or developer privileges." />;
  }

  useEffect(() => {
    getSystemSettings()
      .then((data) => {
        const next = {
          branding: { ...form.branding, ...(data.branding || {}) },
          ai: { ...form.ai, ...(data.ai || {}) },
          communications: { ...form.communications, ...(data.communications || {}) },
          clinical: {
            ...form.clinical,
            ...(data.clinical || {}),
            closeoutPolicy: {
              ...(form.clinical.closeoutPolicy || {}),
              ...(data?.clinical?.closeoutPolicy || {}),
            },
            familyAccess: {
              ...(form.clinical.familyAccess || {}),
              ...(data?.clinical?.familyAccess || {}),
              countryPolicies: {
                ...(form.clinical.familyAccess?.countryPolicies || {}),
                ...(data?.clinical?.familyAccess?.countryPolicies || {}),
              },
            },
          },
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

  const loadEmailHealth = async () => {
    setEmailHealthLoading(true);
    try {
      const data = await getEmailDeliveryHealth();
      setEmailHealth(data);
    } catch (err) {
      setEmailHealth({
        status: "warning",
        provider: "unknown",
        recommendations: [err?.message || "Failed to load email delivery health."],
        checkedAt: new Date().toISOString(),
      });
    } finally {
      setEmailHealthLoading(false);
    }
  };

  useEffect(() => {
    loadEmailHealth();
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
          communications: { ...form.communications, ...(res.settings.communications || {}) },
          clinical: {
            ...form.clinical,
            ...(res.settings.clinical || {}),
            closeoutPolicy: {
              ...(form.clinical.closeoutPolicy || {}),
              ...(res.settings?.clinical?.closeoutPolicy || {}),
            },
            familyAccess: {
              ...(form.clinical.familyAccess || {}),
              ...(res.settings?.clinical?.familyAccess || {}),
              countryPolicies: {
                ...(form.clinical.familyAccess?.countryPolicies || {}),
                ...(res.settings?.clinical?.familyAccess?.countryPolicies || {}),
              },
            },
          },
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
      communications: { communications: form.communications },
      clinical: { clinical: form.clinical },
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

  const lastSyncedLabel = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      })
    : "waiting";

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>System Settings</h2>
          <p className="muted">Branding, payments, and AI configuration.</p>
        </div>
        <div className="welcome-actions">
          <div
            className={`settings-sync-badge ${pushConnected ? "live" : "fallback"}`}
            title={
              lastSyncedAt
                ? `Last synced ${new Date(lastSyncedAt).toLocaleString()}`
                : "Waiting for the first successful sync."
            }
          >
            <span className="settings-sync-dot" />
            <span>{pushConnected ? "Live sync" : "Sync fallback"}</span>
            <span className="settings-sync-separator">•</span>
            <span>Last synced {lastSyncedLabel}</span>
          </div>
          <button type="button" className="btn-primary" onClick={save} disabled={loading}>
            {loading ? "Saving..." : "Save All Settings"}
          </button>
        </div>
      </div>

      {msg && <div className="card">{msg}</div>}

      <section className="section">
        <h3>Email Delivery Health</h3>
        <div className="card">
          <div className="card-header-actions">
            <div>
              <strong>Email provider status</strong>
              <p className="muted" style={{ margin: "6px 0 0" }}>
                Verify whether Brevo email delivery, sender identity, and contact sync are ready on the live backend.
              </p>
            </div>
            <div className="welcome-actions" style={{ gap: 8 }}>
              <span className={`action-pill ${emailHealth?.status === "healthy" ? "ok" : "warn"}`}>
                {emailHealth?.status === "healthy" ? "Healthy" : "Needs attention"}
              </span>
              <button
                type="button"
                className="btn-secondary"
                onClick={loadEmailHealth}
                disabled={emailHealthLoading}
              >
                {emailHealthLoading ? "Refreshing..." : "Refresh Status"}
              </button>
            </div>
          </div>

          <div className="panel-grid" style={{ marginTop: 12 }}>
            <div className="card premium-card">
              <h4>Active Provider</h4>
              <p className="muted">{emailHealth?.provider || "unknown"}</p>
              <p className="muted">
                Sender: {emailHealth?.sender?.name || "AfyaLink HRMS"}{" "}
                {emailHealth?.sender?.emailMasked ? `• ${emailHealth.sender.emailMasked}` : ""}
              </p>
            </div>
            <div className="card premium-card">
              <h4>Brevo API</h4>
              <p className="muted">
                {emailHealth?.brevo?.apiConfigured ? "Configured" : "Missing API key"}
              </p>
              <p className="muted">
                Contact sync: {emailHealth?.brevo?.contactSyncEnabled ? "enabled" : "disabled"}
              </p>
              <p className="muted">
                Lists: {emailHealth?.brevo?.defaultListIds?.length ? emailHealth.brevo.defaultListIds.join(", ") : "none"}
              </p>
            </div>
            <div className="card premium-card">
              <h4>SMTP Fallback</h4>
              <p className="muted">
                {emailHealth?.smtp?.configured ? "Configured" : "Not configured"}
              </p>
              <p className="muted">
                {emailHealth?.smtp?.host || "No SMTP host"} • Port {emailHealth?.smtp?.port || "—"}
              </p>
              <p className="muted">
                Login: {emailHealth?.smtp?.loginMasked || "not set"}
              </p>
            </div>
          </div>

          <div className="panel-grid" style={{ marginTop: 12 }}>
            <div className="card">
              <h4>Recommended Next Checks</h4>
              {emailHealth?.recommendations?.length ? (
                <ul className="muted" style={{ marginTop: 8, paddingLeft: 18 }}>
                  {emailHealth.recommendations.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="muted" style={{ marginTop: 8 }}>
                  Backend email delivery looks ready. Next run <code>{emailHealth?.brevo?.smokeScript || "npm run smoke:brevo-email"}</code> on the backend host.
                </p>
              )}
            </div>
            <div className="card">
              <h4>Smoke Test</h4>
              <p className="muted" style={{ marginTop: 8 }}>
                Command: <code>{emailHealth?.brevo?.smokeScript || "npm run smoke:brevo-email"}</code>
              </p>
              <p className="muted">
                Sandbox default: {emailHealth?.brevo?.smokeSandboxDefault ? "enabled" : "disabled"}
              </p>
              <p className="muted">
                Last checked: {emailHealth?.checkedAt ? new Date(emailHealth.checkedAt).toLocaleString() : "waiting"}
              </p>
            </div>
          </div>
        </div>
      </section>

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
        <div className="card ai-status-card" style={{ marginBottom: "12px" }}>
          <div>
            <strong>Migration status</strong>
            <p className="muted" style={{ margin: "6px 0 0" }}>
              {(() => {
                const raw = settings?.migrations || {};
                const entry = typeof raw?.get === "function" ? raw.get("ai_assistant_enable_v1") : raw.ai_assistant_enable_v1;
                if (entry?.done) {
                  const ranAt = entry.ranAt ? new Date(entry.ranAt).toLocaleString() : "unknown time";
                  return `Completed on ${ranAt} — hospitals updated: ${entry.hospitalsModified ?? 0}.`;
                }
                return "Pending — migration will run on next backend start.";
              })()}
            </p>
          </div>
        </div>
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
          <label>AI Floating Icon</label>
          {form.ai.icon ? (
            <div className="row" style={{ alignItems: "center", gap: "10px" }}>
              <img
                src={form.ai.icon}
                alt="AI icon"
                style={{ width: "48px", height: "48px", borderRadius: "12px", objectFit: "cover" }}
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setForm((f) => ({ ...f, ai: { ...f.ai, icon: "" } }))}
              >
                Remove Icon
              </button>
            </div>
          ) : null}
          <input
            type="file"
            accept="image/*"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const dataUrl = await optimizeImageDataUrl(file, { maxDimension: 320, targetBytes: 180 * 1024 });
              setForm((f) => ({ ...f, ai: { ...f.ai, icon: dataUrl } }));
            }}
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

      <section className="section">
        <h3>Consultation Controls</h3>
        <div className="card form">
          <label>
            <input
              type="checkbox"
              checked={form.communications.callsEnabled}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  communications: { ...f.communications, callsEnabled: e.target.checked },
                }))
              }
            />
            Enable all calls
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.communications.voiceCallsEnabled}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  communications: { ...f.communications, voiceCallsEnabled: e.target.checked },
                }))
              }
            />
            Enable voice calls
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.communications.videoCallsEnabled}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  communications: { ...f.communications, videoCallsEnabled: e.target.checked },
                }))
              }
            />
            Enable video calls
          </label>
          <button
            type="button"
            className="btn-primary"
            onClick={() => saveCard("communications")}
            disabled={loading || savingCard === "communications"}
          >
            {savingCard === "communications" ? "Saving..." : "Save Consultation Controls"}
          </button>
        </div>
      </section>

      <section className="section">
        <h3>Clinical Closeout Policy</h3>
        <div className="card form">
          <p className="muted">
            Define what must be completed before a visit can be closed. Billing and prescription rules only apply when the hospital has those modules enabled.
          </p>
          <label>
            <input
              type="checkbox"
              checked={Boolean(form.clinical.closeoutPolicy.requireDiagnosisBeforeClose)}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  clinical: {
                    ...f.clinical,
                    closeoutPolicy: {
                      ...(f.clinical?.closeoutPolicy || {}),
                      requireDiagnosisBeforeClose: e.target.checked,
                    },
                  },
                }))
              }
            />
            Require diagnosis or consultation summary before visit close
          </label>
          <label>
            <input
              type="checkbox"
              checked={Boolean(form.clinical.closeoutPolicy.requireBillingHandoffWhenPaymentsEnabled)}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  clinical: {
                    ...f.clinical,
                    closeoutPolicy: {
                      ...(f.clinical?.closeoutPolicy || {}),
                      requireBillingHandoffWhenPaymentsEnabled: e.target.checked,
                    },
                  },
                }))
              }
            />
            Require billing handoff when payments are enabled
          </label>
          <label>
            <input
              type="checkbox"
              checked={Boolean(form.clinical.closeoutPolicy.requirePrescriptionWhenPharmacyEnabled)}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  clinical: {
                    ...f.clinical,
                    closeoutPolicy: {
                      ...(f.clinical?.closeoutPolicy || {}),
                      requirePrescriptionWhenPharmacyEnabled: e.target.checked,
                    },
                  },
                }))
              }
            />
            Require prescription handoff when pharmacy is enabled
          </label>
          <button
            type="button"
            className="btn-primary"
            onClick={() => saveCard("clinical")}
            disabled={loading || savingCard === "clinical"}
          >
            {savingCard === "clinical" ? "Saving..." : "Save Clinical Closeout Policy"}
          </button>
        </div>
      </section>

      <section className="section">
        <h3>Family Access & Teen Consent Policy</h3>
        <div className="card form">
          <p className="muted">
            Tune when parents have full proxy visibility, when teens move into shared access, and whether family-anchor OTP approval is required before one national ID can serve spouse and child records.
          </p>
          <label>
            <input
              type="checkbox"
              checked={Boolean(form.clinical.familyAccess.requireOtpForFamilyAnchor)}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  clinical: {
                    ...f.clinical,
                    familyAccess: {
                      ...(f.clinical?.familyAccess || {}),
                      requireOtpForFamilyAnchor: e.target.checked,
                    },
                  },
                }))
              }
            />
            Require OTP approval before a standalone family national ID anchor becomes trusted
          </label>
          <label>
            <input
              type="checkbox"
              checked={Boolean(form.clinical.familyAccess.allowSingleAnchorForSpouseAndChildren)}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  clinical: {
                    ...f.clinical,
                    familyAccess: {
                      ...(f.clinical?.familyAccess || {}),
                      allowSingleAnchorForSpouseAndChildren: e.target.checked,
                    },
                  },
                }))
              }
            />
            Allow one approved family anchor ID to serve spouse and child records
          </label>
          <label>
            Family OTP TTL (seconds)
            <input
              type="number"
              min="60"
              step="30"
              value={form.clinical.familyAccess.otpTtlSeconds || 600}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  clinical: {
                    ...f.clinical,
                    familyAccess: {
                      ...(f.clinical?.familyAccess || {}),
                      otpTtlSeconds: Number(e.target.value || 600),
                    },
                  },
                }))
              }
            />
          </label>

          <div className="panel-grid">
            {["DEFAULT", "KE", "UG", "TZ"].map((countryCode) => {
              const policy = form.clinical.familyAccess?.countryPolicies?.[countryCode] || {};
              return (
                <div key={countryCode} className="card premium-card">
                  <h4>{policy.label || countryCode}</h4>
                  <label>
                    <input
                      type="checkbox"
                      checked={policy.enabled !== false}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          clinical: {
                            ...f.clinical,
                            familyAccess: {
                              ...(f.clinical?.familyAccess || {}),
                              countryPolicies: {
                                ...(f.clinical?.familyAccess?.countryPolicies || {}),
                                [countryCode]: {
                                  ...(f.clinical?.familyAccess?.countryPolicies?.[countryCode] || {}),
                                  enabled: e.target.checked,
                                },
                              },
                            },
                          },
                        }))
                      }
                    />
                    Policy enabled
                  </label>
                  <label>
                    Full parent proxy max age
                    <input
                      type="number"
                      min="0"
                      max="17"
                      value={policy.fullProxyMaxAge ?? 15}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          clinical: {
                            ...f.clinical,
                            familyAccess: {
                              ...(f.clinical?.familyAccess || {}),
                              countryPolicies: {
                                ...(f.clinical?.familyAccess?.countryPolicies || {}),
                                [countryCode]: {
                                  ...(f.clinical?.familyAccess?.countryPolicies?.[countryCode] || {}),
                                  fullProxyMaxAge: Number(e.target.value || 15),
                                },
                              },
                            },
                          },
                        }))
                      }
                    />
                  </label>
                  <label>
                    Shared access starts at age
                    <input
                      type="number"
                      min="0"
                      max="17"
                      value={policy.sharedAccessMinAge ?? 16}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          clinical: {
                            ...f.clinical,
                            familyAccess: {
                              ...(f.clinical?.familyAccess || {}),
                              countryPolicies: {
                                ...(f.clinical?.familyAccess?.countryPolicies || {}),
                                [countryCode]: {
                                  ...(f.clinical?.familyAccess?.countryPolicies?.[countryCode] || {}),
                                  sharedAccessMinAge: Number(e.target.value || 16),
                                },
                              },
                            },
                          },
                        }))
                      }
                    />
                  </label>
                  <label>
                    Adult consent age
                    <input
                      type="number"
                      min="18"
                      max="25"
                      value={policy.adultAge ?? 18}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          clinical: {
                            ...f.clinical,
                            familyAccess: {
                              ...(f.clinical?.familyAccess || {}),
                              countryPolicies: {
                                ...(f.clinical?.familyAccess?.countryPolicies || {}),
                                [countryCode]: {
                                  ...(f.clinical?.familyAccess?.countryPolicies?.[countryCode] || {}),
                                  adultAge: Number(e.target.value || 18),
                                },
                              },
                            },
                          },
                        }))
                      }
                    />
                  </label>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={() => saveCard("clinical")}
            disabled={loading || savingCard === "clinical"}
          >
            {savingCard === "clinical" ? "Saving..." : "Save Family Access Policy"}
          </button>
        </div>
      </section>
    </div>
  );
}
