import React, { useEffect, useState } from "react";
import apiFetch from "../../utils/apiFetch";
import {
  createCustomizationRequest,
  listCustomizationRequests,
} from "../../services/customizationRequestApi";

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
  const [savingCard, setSavingCard] = useState("");
  const [msg, setMsg] = useState("");
  const [requests, setRequests] = useState([]);
  const [reqSaving, setReqSaving] = useState(false);
  const [requestForm, setRequestForm] = useState({
    scope: "HOSPITAL",
    country: "",
    title: "",
    requirements: "",
    requestedModules: "",
    exclusiveDeployment: true,
    desiredGoLiveDate: "",
  });

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
      const reqData = await listCustomizationRequests();
      setRequests(reqData?.items || []);
    } catch {
      setForm(DEFAULT_FORM);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const persistCustomization = async (customizationPatch, successMsg = "Hospital customization saved successfully.") => {
    setSaving(true);
    setMsg("");
    try {
      await apiFetch("/api/hospital-admin/customization", {
        method: "PUT",
        body: { customization: customizationPatch },
      });
      setMsg(successMsg);
      await load();
    } catch (error) {
      setMsg(error?.message || "Failed to save customization.");
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    await persistCustomization(form, "All customization settings saved.");
  };

  const saveCard = async (key) => {
    const patchMap = {
      enabled: { enabled: form.enabled },
      branding: { branding: form.branding },
      theme: { theme: form.theme },
      modules: { modules: form.modules },
    };
    if (!patchMap[key]) return;
    setSavingCard(key);
    await persistCustomization(
      patchMap[key],
      `${key.charAt(0).toUpperCase()}${key.slice(1)} settings saved.`
    );
    setSavingCard("");
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

  const submitRequest = async () => {
    setReqSaving(true);
    setMsg("");
    try {
      await createCustomizationRequest({
        scope: requestForm.scope,
        country: requestForm.country,
        title: requestForm.title,
        requirements: requestForm.requirements,
        requestedModules: String(requestForm.requestedModules || "")
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
        exclusiveDeployment: requestForm.exclusiveDeployment,
        desiredGoLiveDate: requestForm.desiredGoLiveDate || undefined,
      });
      setMsg("Customization request submitted. AfyaLink developers will review and deliver your dedicated version plan.");
      setRequestForm({
        scope: "HOSPITAL",
        country: "",
        title: "",
        requirements: "",
        requestedModules: "",
        exclusiveDeployment: true,
        desiredGoLiveDate: "",
      });
      await load();
    } catch (error) {
      setMsg(error?.message || "Failed to submit customization request.");
    } finally {
      setReqSaving(false);
    }
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
        <div className="welcome-actions">
          <button type="button" className="btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save All Customization"}
          </button>
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
          <button
            type="button"
            className="btn-primary"
            onClick={() => saveCard("enabled")}
            disabled={saving || savingCard === "enabled"}
          >
            {savingCard === "enabled" ? "Saving..." : "Save Activation"}
          </button>
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
          <button
            type="button"
            className="btn-primary"
            onClick={() => saveCard("branding")}
            disabled={saving || savingCard === "branding"}
          >
            {savingCard === "branding" ? "Saving..." : "Save Branding"}
          </button>
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
          <button
            type="button"
            className="btn-primary"
            onClick={() => saveCard("theme")}
            disabled={saving || savingCard === "theme"}
          >
            {savingCard === "theme" ? "Saving..." : "Save Theme"}
          </button>
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
          <button
            type="button"
            className="btn-primary"
            onClick={() => saveCard("modules")}
            disabled={saving || savingCard === "modules"}
          >
            {savingCard === "modules" ? "Saving..." : "Save Module Visibility"}
          </button>
        </div>
      </section>

      <section className="section">
        <h3>Dedicated Version Request (Hospital/Country)</h3>
        <div className="card form">
          <label>Scope</label>
          <select
            value={requestForm.scope}
            onChange={(e) => setRequestForm((prev) => ({ ...prev, scope: e.target.value }))}
          >
            <option value="HOSPITAL">Hospital-only</option>
            <option value="COUNTRY">Country program</option>
            <option value="REGION">Regional deployment</option>
            <option value="GLOBAL">Global variant</option>
          </select>

          <label>Country (optional, ISO code)</label>
          <input
            value={requestForm.country}
            onChange={(e) => setRequestForm((prev) => ({ ...prev, country: e.target.value }))}
            placeholder="KE"
          />

          <label>Request title</label>
          <input
            value={requestForm.title}
            onChange={(e) => setRequestForm((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Private pharmacy referral workflow"
          />

          <label>Requirements</label>
          <textarea
            rows={4}
            value={requestForm.requirements}
            onChange={(e) => setRequestForm((prev) => ({ ...prev, requirements: e.target.value }))}
            placeholder="Describe required workflows, integrations, compliance, and reports."
          />

          <label>Requested modules (comma-separated)</label>
          <input
            value={requestForm.requestedModules}
            onChange={(e) => setRequestForm((prev) => ({ ...prev, requestedModules: e.target.value }))}
            placeholder="HL7 lab ingest, custom payroll, national reports"
          />

          <label>
            <input
              type="checkbox"
              checked={requestForm.exclusiveDeployment}
              onChange={(e) =>
                setRequestForm((prev) => ({ ...prev, exclusiveDeployment: e.target.checked }))
              }
            />
            Dedicated private version (exclusive to requester)
          </label>

          <label>Desired go-live date</label>
          <input
            type="date"
            value={requestForm.desiredGoLiveDate}
            onChange={(e) => setRequestForm((prev) => ({ ...prev, desiredGoLiveDate: e.target.value }))}
          />

          <button type="button" className="btn-secondary" onClick={submitRequest} disabled={reqSaving}>
            {reqSaving ? "Submitting..." : "Submit Dedicated Version Request"}
          </button>
        </div>
      </section>

      <section className="section">
        <h3>Recent Customization Requests</h3>
        <div className="card table-wrap">
          <table className="table lite">
            <thead>
              <tr>
                <th>Created</th>
                <th>Title</th>
                <th>Scope</th>
                <th>Status</th>
                <th>Exclusive</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={5}>No requests yet.</td>
                </tr>
              ) : (
                requests.map((r) => (
                  <tr key={r._id}>
                    <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td>{r.title}</td>
                    <td>{r.scope}{r.country ? ` (${r.country})` : ""}</td>
                    <td>{r.status}</td>
                    <td>{r.exclusiveDeployment ? "Yes" : "No"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
