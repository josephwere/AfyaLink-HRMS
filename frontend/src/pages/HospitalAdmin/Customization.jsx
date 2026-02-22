import React, { useEffect, useState } from "react";
import apiFetch from "../../utils/apiFetch";

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const DEFAULT_FORM = {
  enabled: true,
  branding: {
    appName: "",
    tagline: "",
    logo: "",
    appIcon: "",
    favicon: "",
    loginBackground: "",
    homeBackground: "",
  },
  theme: {
    primaryColor: "",
    accentColor: "",
    sidebarStyle: "DEFAULT",
    topbarStyle: "DEFAULT",
  },
  modules: {
    showAI: true,
    showReports: true,
    showAnalytics: true,
  },
};

export default function HospitalCustomization() {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/hospital-admin/config");
      setForm({
        ...DEFAULT_FORM,
        ...(data?.customization || {}),
        branding: {
          ...DEFAULT_FORM.branding,
          ...(data?.customization?.branding || {}),
        },
        theme: {
          ...DEFAULT_FORM.theme,
          ...(data?.customization?.theme || {}),
        },
        modules: {
          ...DEFAULT_FORM.modules,
          ...(data?.customization?.modules || {}),
        },
      });
    } catch {
      setForm(DEFAULT_FORM);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    setMsg("");
    try {
      await apiFetch("/api/hospital-admin/customization", {
        method: "PUT",
        body: { customization: form },
      });
      setMsg("Hospital customization saved successfully.");
      await load();
    } catch (error) {
      setMsg(error?.message || "Failed to save customization.");
    } finally {
      setSaving(false);
    }
  };

  const uploadBranding = async (key, file) => {
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setForm((prev) => ({
      ...prev,
      branding: {
        ...prev.branding,
        [key]: dataUrl,
      },
    }));
  };

  if (loading) return <p>Loading customization...</p>;

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Hospital Customization</h2>
          <p className="muted">
            Make AfyaLink match your hospital identity, theme, and module preferences.
          </p>
        </div>
      </div>

      {msg && <div className="card">{msg}</div>}

      <section className="section">
        <h3>Activation</h3>
        <div className="card form">
          <label>
            <input
              type="checkbox"
              checked={Boolean(form.enabled)}
              onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))}
            />
            Enable hospital customization
          </label>
        </div>
      </section>

      <section className="section">
        <h3>Branding</h3>
        <div className="card form">
          <label>App Name</label>
          <input
            value={form.branding.appName}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                branding: { ...prev.branding, appName: e.target.value },
              }))
            }
          />
          <label>Tagline</label>
          <input
            value={form.branding.tagline}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                branding: { ...prev.branding, tagline: e.target.value },
              }))
            }
          />
          <label>Logo</label>
          <input type="file" accept="image/*" onChange={(e) => uploadBranding("logo", e.target.files?.[0])} />
          <label>App Icon</label>
          <input type="file" accept="image/*" onChange={(e) => uploadBranding("appIcon", e.target.files?.[0])} />
          <label>Favicon</label>
          <input type="file" accept="image/*" onChange={(e) => uploadBranding("favicon", e.target.files?.[0])} />
          <label>Login Background</label>
          <input type="file" accept="image/*" onChange={(e) => uploadBranding("loginBackground", e.target.files?.[0])} />
          <label>Home Background</label>
          <input type="file" accept="image/*" onChange={(e) => uploadBranding("homeBackground", e.target.files?.[0])} />
        </div>
      </section>

      <section className="section">
        <h3>Theme</h3>
        <div className="card form">
          <label>Primary Color</label>
          <input
            type="color"
            value={form.theme.primaryColor || "#2c3e50"}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                theme: { ...prev.theme, primaryColor: e.target.value },
              }))
            }
          />
          <label>Accent Color</label>
          <input
            type="color"
            value={form.theme.accentColor || "#4caf50"}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                theme: { ...prev.theme, accentColor: e.target.value },
              }))
            }
          />
          <label>Sidebar Style</label>
          <select
            value={form.theme.sidebarStyle}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                theme: { ...prev.theme, sidebarStyle: e.target.value },
              }))
            }
          >
            <option value="DEFAULT">Default</option>
            <option value="COMPACT">Compact</option>
            <option value="WIDE">Wide</option>
          </select>
          <label>Topbar Style</label>
          <select
            value={form.theme.topbarStyle}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                theme: { ...prev.theme, topbarStyle: e.target.value },
              }))
            }
          >
            <option value="DEFAULT">Default</option>
            <option value="MINIMAL">Minimal</option>
            <option value="DENSE">Dense</option>
          </select>
        </div>
      </section>

      <section className="section">
        <h3>Module Visibility</h3>
        <div className="card form">
          <label>
            <input
              type="checkbox"
              checked={Boolean(form.modules.showAI)}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  modules: { ...prev.modules, showAI: e.target.checked },
                }))
              }
            />
            Show AI features in hospital UI
          </label>
          <label>
            <input
              type="checkbox"
              checked={Boolean(form.modules.showReports)}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  modules: { ...prev.modules, showReports: e.target.checked },
                }))
              }
            />
            Show Reports navigation
          </label>
          <label>
            <input
              type="checkbox"
              checked={Boolean(form.modules.showAnalytics)}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  modules: { ...prev.modules, showAnalytics: e.target.checked },
                }))
              }
            />
            Show Analytics navigation
          </label>
        </div>
      </section>

      <section className="section">
        <button type="button" className="btn-primary" onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save Customization"}
        </button>
      </section>
    </div>
  );
}
