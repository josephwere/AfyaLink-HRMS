import React, { useEffect, useState } from "react";
import apiFetch from "../../utils/apiFetch";
import EditableSection from "../../components/EditableSection";
import ContentSkeleton from "../../components/ContentSkeleton";
import { TableEmptyState } from "../../components/GuidedEmptyState";
import { showActionSuccessGuide } from "../../components/ActionSuccessGuide";
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
  clinical: {
    closeoutPolicy: {
      enabled: false,
      requireDiagnosisBeforeClose: null,
      requireBillingHandoffWhenPaymentsEnabled: null,
      requirePrescriptionWhenPharmacyEnabled: null,
    },
  },
};

const CONFIG_SECTION_KEYS = ["enabled", "branding", "theme", "modules", "clinical"];

function sectionSavedState(saved = true) {
  return CONFIG_SECTION_KEYS.reduce((acc, key) => ({ ...acc, [key]: saved }), {});
}

function sectionEditingState(editing = false) {
  return CONFIG_SECTION_KEYS.reduce((acc, key) => ({ ...acc, [key]: editing }), {});
}

export default function HospitalCustomization() {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingCard, setSavingCard] = useState("");
  const [msg, setMsg] = useState("");
  const [sectionSaved, setSectionSaved] = useState(sectionSavedState(false));
  const [sectionEditing, setSectionEditing] = useState(sectionEditingState(true));
  const [requests, setRequests] = useState([]);
  const [reqSaving, setReqSaving] = useState(false);
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [requestEditing, setRequestEditing] = useState(true);
  const [requestForm, setRequestForm] = useState({
    scope: "HOSPITAL",
    country: "",
    title: "",
    requirements: "",
    requestedModules: "",
    exclusiveDeployment: true,
    desiredGoLiveDate: "",
  });

  const load = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
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
        clinical: {
          ...DEFAULT_FORM.clinical,
          ...(data?.customization?.clinical || {}),
          closeoutPolicy: {
            ...(DEFAULT_FORM.clinical.closeoutPolicy || {}),
            ...(data?.customization?.clinical?.closeoutPolicy || {}),
          },
        },
      });
      const reqData = await listCustomizationRequests();
      setRequests(reqData?.items || []);
      setSectionSaved(sectionSavedState(true));
      setSectionEditing(sectionEditingState(false));
    } catch {
      setForm(DEFAULT_FORM);
      setRequests([]);
      setSectionSaved(sectionSavedState(false));
      setSectionEditing(sectionEditingState(true));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const showCustomizationSuccess = (title, sectionName = "customization") => {
    showActionSuccessGuide({
      title,
      message: "The hospital configuration is saved and ready for staff-facing workflows.",
      icon: "✓",
      notificationTitle: title,
      notificationBody: "Hospital customization settings were updated.",
      notificationCategory: "ACCOUNT",
      aiRecommendation: "Ask AI to review the updated hospital experience before presenting it to staff.",
      nextActions: [
        {
          label: "Review With AI",
          action: "ai",
          variant: "secondary",
          aiPrompt: `Review this AfyaLink hospital ${sectionName} configuration and suggest any production-readiness checks.`,
        },
      ],
    });
  };

  const persistCustomization = async (
    customizationPatch,
    successMsg = "Hospital customization saved successfully.",
    sectionKey = ""
  ) => {
    setSaving(true);
    setMsg("");
    try {
      await apiFetch("/api/hospital-admin/customization", {
        method: "PUT",
        body: { customization: customizationPatch },
      });
      if (sectionKey) {
        setSectionSaved((prev) => ({ ...prev, [sectionKey]: true }));
        setSectionEditing((prev) => ({ ...prev, [sectionKey]: false }));
      } else {
        setSectionSaved(sectionSavedState(true));
        setSectionEditing(sectionEditingState(false));
      }
      showCustomizationSuccess(successMsg, sectionKey || "all customization settings");
      await load({ silent: true });
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
      clinical: { clinical: form.clinical },
    };
    if (!patchMap[key]) return;
    setSavingCard(key);
    await persistCustomization(
      patchMap[key],
      `${key.charAt(0).toUpperCase()}${key.slice(1)} settings saved.`,
      key
    );
    setSavingCard("");
  };

  const editSection = (key) => setSectionEditing((prev) => ({ ...prev, [key]: true }));
  const cancelSection = (key) => setSectionEditing((prev) => ({ ...prev, [key]: false }));

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
      setRequestSubmitted(true);
      setRequestEditing(false);
      showActionSuccessGuide({
        title: "Dedicated Version Request Submitted",
        message: "AfyaLink developers will review the request and prepare the next implementation plan.",
        icon: "✓",
        notificationTitle: "Customization request submitted",
        notificationBody: "A dedicated version request is ready for review.",
        notificationCategory: "ACCOUNT",
        aiRecommendation: "Ask AI to convert this request into a launch checklist for your hospital team.",
        nextActions: [
          {
            label: "Prepare With AI",
            action: "ai",
            variant: "secondary",
            aiPrompt: "Create a practical launch checklist for a dedicated AfyaLink hospital or country deployment request.",
          },
        ],
      });
      setRequestForm({
        scope: "HOSPITAL",
        country: "",
        title: "",
        requirements: "",
        requestedModules: "",
        exclusiveDeployment: true,
        desiredGoLiveDate: "",
      });
      await load({ silent: true });
    } catch (error) {
      setMsg(error?.message || "Failed to submit customization request.");
    } finally {
      setReqSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard">
        <ContentSkeleton title="Loading hospital customization" variant="cards" cards={4} />
      </div>
    );
  }

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

      {msg && <div className="card status-card error">{msg}</div>}

      <section className="section">
        <EditableSection
          title="Activation"
          description="Control whether this hospital uses custom branding and workflow settings."
          saved={sectionSaved.enabled}
          editing={sectionEditing.enabled}
          saving={saving || savingCard === "enabled"}
          saveLabel="Save Activation"
          onEdit={() => editSection("enabled")}
          onCancel={() => cancelSection("enabled")}
          onSave={() => saveCard("enabled")}
        >
          <label>
            <input
              type="checkbox"
              checked={Boolean(form.enabled)}
              onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))}
            />
            Enable hospital customization
          </label>
        </EditableSection>
      </section>

      <section className="section">
        <EditableSection
          title="Branding"
          description="Manage the visible name, logo, icon, and background assets for the hospital workspace."
          saved={sectionSaved.branding}
          editing={sectionEditing.branding}
          saving={saving || savingCard === "branding"}
          saveLabel="Save Branding"
          onEdit={() => editSection("branding")}
          onCancel={() => cancelSection("branding")}
          onSave={() => saveCard("branding")}
        >
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
        </EditableSection>
      </section>

      <section className="section">
        <EditableSection
          title="Theme"
          description="Set the hospital color system and navigation density."
          saved={sectionSaved.theme}
          editing={sectionEditing.theme}
          saving={saving || savingCard === "theme"}
          saveLabel="Save Theme"
          onEdit={() => editSection("theme")}
          onCancel={() => cancelSection("theme")}
          onSave={() => saveCard("theme")}
        >
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
        </EditableSection>
      </section>

      <section className="section">
        <EditableSection
          title="Module Visibility"
          description="Choose which major hospital modules should be visible to staff."
          saved={sectionSaved.modules}
          editing={sectionEditing.modules}
          saving={saving || savingCard === "modules"}
          saveLabel="Save Module Visibility"
          onEdit={() => editSection("modules")}
          onCancel={() => cancelSection("modules")}
          onSave={() => saveCard("modules")}
        >
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
        </EditableSection>
      </section>

      <section className="section">
        <EditableSection
          title="Clinical Workflow Overrides"
          description="Override visit-close rules for this hospital only when required by operations."
          saved={sectionSaved.clinical}
          editing={sectionEditing.clinical}
          saving={saving || savingCard === "clinical"}
          saveLabel="Save Clinical Overrides"
          onEdit={() => editSection("clinical")}
          onCancel={() => cancelSection("clinical")}
          onSave={() => saveCard("clinical")}
        >
          <p className="muted">
            Override the global visit-close rules for this hospital only. Leave the override disabled to inherit the system-wide policy.
          </p>
          <label>
            <input
              type="checkbox"
              checked={Boolean(form.clinical?.closeoutPolicy?.enabled)}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  clinical: {
                    ...(prev.clinical || {}),
                    closeoutPolicy: {
                      ...(prev.clinical?.closeoutPolicy || {}),
                      enabled: e.target.checked,
                    },
                  },
                }))
              }
            />
            Enable hospital-specific closeout policy
          </label>
          <label>
            <input
              type="checkbox"
              checked={Boolean(form.clinical?.closeoutPolicy?.requireDiagnosisBeforeClose)}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  clinical: {
                    ...(prev.clinical || {}),
                    closeoutPolicy: {
                      ...(prev.clinical?.closeoutPolicy || {}),
                      requireDiagnosisBeforeClose: e.target.checked,
                    },
                  },
                }))
              }
              disabled={!form.clinical?.closeoutPolicy?.enabled}
            />
            Require diagnosis before visit close
          </label>
          <label>
            <input
              type="checkbox"
              checked={Boolean(form.clinical?.closeoutPolicy?.requireBillingHandoffWhenPaymentsEnabled)}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  clinical: {
                    ...(prev.clinical || {}),
                    closeoutPolicy: {
                      ...(prev.clinical?.closeoutPolicy || {}),
                      requireBillingHandoffWhenPaymentsEnabled: e.target.checked,
                    },
                  },
                }))
              }
              disabled={!form.clinical?.closeoutPolicy?.enabled}
            />
            Require billing handoff when payments are enabled
          </label>
          <label>
            <input
              type="checkbox"
              checked={Boolean(form.clinical?.closeoutPolicy?.requirePrescriptionWhenPharmacyEnabled)}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  clinical: {
                    ...(prev.clinical || {}),
                    closeoutPolicy: {
                      ...(prev.clinical?.closeoutPolicy || {}),
                      requirePrescriptionWhenPharmacyEnabled: e.target.checked,
                    },
                  },
                }))
              }
              disabled={!form.clinical?.closeoutPolicy?.enabled}
            />
            Require prescription handoff when pharmacy is enabled
          </label>
        </EditableSection>
      </section>

      <section className="section">
        <EditableSection
          title="Dedicated Version Request"
          description="Request a hospital, regional, country, or global AfyaLink variant for a specific program."
          saved={requestSubmitted}
          editing={requestEditing}
          saving={reqSaving}
          saveLabel="Submit Dedicated Version Request"
          onEdit={() => setRequestEditing(true)}
          onCancel={() => setRequestEditing(false)}
          onSave={submitRequest}
        >
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
        </EditableSection>
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
                <TableEmptyState
                  colSpan={5}
                  icon="Req"
                  title="No Customization Requests Yet"
                  body="Dedicated version requests will appear here after they are submitted."
                  actions={[
                    {
                      label: "Plan With AI",
                      aiPrompt: "Help me draft a dedicated AfyaLink customization request with scope, modules, compliance, and launch needs.",
                    },
                  ]}
                />
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
