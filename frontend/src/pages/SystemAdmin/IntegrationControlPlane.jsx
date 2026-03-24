import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import EyeIcon from "../../components/EyeIcon";
import { getIntegrationControlPlane } from "../../services/systemAdminApi";
import { getSystemSettings, updateSystemSettings } from "../../services/systemSettingsApi";
import apiFetch from "../../utils/apiFetch";

function tone(status) {
  if (status === "READY") return "good";
  if (status === "AT_RISK") return "warn";
  if (status === "DEGRADED") return "risk";
  if (status === "DISABLED") return "warn";
  return "muted";
}

export default function IntegrationControlPlane() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [clientMeta, setClientMeta] = useState(null);
  const [govConfig, setGovConfig] = useState({
    sha: {
      baseUrl: "",
      tokenUrl: "",
      preauthUrl: "",
      apiToken: "",
      clientId: "",
      clientSecret: "",
      audience: "",
      timeoutMs: 8000,
    },
    etims: {
      baseUrl: "",
      tokenUrl: "",
      invoiceUrl: "",
      apiKey: "",
      apiToken: "",
      clientId: "",
      clientSecret: "",
      timeoutMs: 8000,
    },
  });
  const [showSecrets, setShowSecrets] = useState({
    shaApiToken: false,
    shaClientSecret: false,
    etimsApiKey: false,
    etimsApiToken: false,
    etimsClientSecret: false,
  });
  const [showOnHover, setShowOnHover] = useState(false);
  const [govSaving, setGovSaving] = useState(false);
  const [govMessage, setGovMessage] = useState("");
  const modulesSectionRef = useRef(null);
  const credentialsSectionRef = useRef(null);
  const requestRef = useRef(0);

  const scrollToSection = (ref) => {
    ref?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const load = useCallback(async ({ preserveData = false } = {}) => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setLoading(true);
    setError("");
    try {
      const [res, settings, profile] = await Promise.all([
        getIntegrationControlPlane(),
        getSystemSettings(),
        apiFetch("/api/profile"),
      ]);
      if (requestRef.current !== requestId) return;
      setData(res?.payload || null);
      setClientMeta(res?.clientMeta || null);
      const incoming = settings?.governmentApis || {};
      setShowOnHover(Boolean(profile?.uiPreferences?.showSecretsOnHover));
      setGovConfig({
        sha: {
          baseUrl: incoming?.sha?.baseUrl || "",
          tokenUrl: incoming?.sha?.tokenUrl || "",
          preauthUrl: incoming?.sha?.preauthUrl || "",
          apiToken: incoming?.sha?.apiToken || "",
          clientId: incoming?.sha?.clientId || "",
          clientSecret: incoming?.sha?.clientSecret || "",
          audience: incoming?.sha?.audience || "",
          timeoutMs: incoming?.sha?.timeoutMs || 8000,
        },
        etims: {
          baseUrl: incoming?.etims?.baseUrl || "",
          tokenUrl: incoming?.etims?.tokenUrl || "",
          invoiceUrl: incoming?.etims?.invoiceUrl || "",
          apiKey: incoming?.etims?.apiKey || "",
          apiToken: incoming?.etims?.apiToken || "",
          clientId: incoming?.etims?.clientId || "",
          clientSecret: incoming?.etims?.clientSecret || "",
          timeoutMs: incoming?.etims?.timeoutMs || 8000,
        },
      });
    } catch (err) {
      if (requestRef.current !== requestId) return;
      setError(err?.message || "Failed to load integration control plane");
      if (!preserveData) setData(null);
    } finally {
      if (requestRef.current === requestId) setLoading(false);
    }
  }, []);

  const saveGovConfig = async () => {
    setGovSaving(true);
    setGovMessage("");
    try {
      await updateSystemSettings({ governmentApis: govConfig });
      setGovMessage("Government API credentials saved.");
      await load({ preserveData: true });
    } catch (err) {
      setGovMessage(err?.message || "Failed to save government API credentials.");
    } finally {
      setGovSaving(false);
    }
  };

  const saveHoverPreference = async (nextValue) => {
    setShowOnHover(nextValue);
    try {
      await apiFetch("/api/profile", {
        method: "PUT",
        body: { uiPreferences: { showSecretsOnHover: nextValue } },
      });
      setGovMessage("Preference saved.");
    } catch (err) {
      setGovMessage(err?.message || "Failed to save preference.");
    }
  };

  const toggleSecret = (key) => {
    setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const hoverSecret = (key, value) => {
    if (!showOnHover) return;
    setShowSecrets((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    load({ preserveData: false });
  }, [load]);

  const hasData = Boolean(data);
  const initialLoading = loading && !hasData;
  const refreshing = loading && hasData;

  const controlPlanes = Array.isArray(data?.controlPlanes) ? data.controlPlanes : [];
  const providers = Array.isArray(data?.providers) ? data.providers : [];

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Integration Control Plane</h2>
          <p className="muted">Operational rollout view for SHA, eTIMS, M-PESA, claims, and payment readiness.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate("/system-admin/integration-hub")}>
            Integration Hub
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/admin/realtime")}>
            Live Integrations
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/admin/payment-settings")}>
            Payment Settings
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => load({ preserveData: hasData })}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="premium-inline-note innovation-console-inline-state">
        <span>
          {refreshing
            ? "Refreshing live rollout posture while the current control plane stays visible."
            : clientMeta?.attempts > 1
            ? `Loaded after ${clientMeta.attempts} guarded attempts to absorb cold-start latency.`
            : clientMeta?.loadedAt
            ? `Live sync completed ${new Date(clientMeta.loadedAt).toLocaleString()}.`
            : "Warm-start protection is ready for the first live pull."}
        </span>
        {refreshing ? <span className="action-pill">Live sync in progress</span> : null}
      </div>

      {initialLoading ? (
        <section className="section">
          <div className="card premium-card innovation-console-state-card">
            <span className="developer-tool-eyebrow">Warm start</span>
            <strong>Preparing live rollout posture</strong>
            <p className="muted">
              We are waking the backend and waiting for the first control-plane snapshot so this
              page does not flash a false timeout on cold start.
            </p>
            <div className="innovation-console-skeleton-grid" aria-hidden="true">
              <div className="innovation-console-skeleton" />
              <div className="innovation-console-skeleton" />
              <div className="innovation-console-skeleton" />
              <div className="innovation-console-skeleton" />
            </div>
          </div>
        </section>
      ) : null}

      {error ? (
        <div className="premium-inline-note innovation-console-inline-state innovation-console-inline-state-warn">
          <span>{error}</span>
          <button type="button" className="btn-secondary" onClick={() => load({ preserveData: hasData })}>
            Retry now
          </button>
        </div>
      ) : null}
      {govMessage ? <div className="card">{govMessage}</div> : null}

      {hasData ? (
        <>
      <section className="section">
        <h3>Rollout Snapshot</h3>
        <div className="grid info-grid">
          <StatCard title="Hospitals With Payments" value={data?.summary?.paymentEnabledHospitals ?? 0} onClick={() => navigate("/admin/payment-settings")} />
          <StatCard title="SHA Coverage" value={data?.summary?.shaCoverageHospitals ?? 0} onClick={() => scrollToSection(credentialsSectionRef)} />
          <StatCard title="M-PESA Coverage" value={data?.summary?.mpesaCoverageHospitals ?? 0} onClick={() => navigate("/admin/payment-settings")} />
          <StatCard title="Overdue Invoices" value={data?.summary?.overdueInvoices ?? 0} onClick={() => navigate("/payments/full")} />
          <StatCard title="Transactions 30d" value={data?.summary?.totalTransactions30d ?? 0} onClick={() => scrollToSection(modulesSectionRef)} />
          <StatCard title="Succeeded 30d" value={data?.summary?.succeededTransactions30d ?? 0} onClick={() => scrollToSection(modulesSectionRef)} />
        </div>
      </section>

      <section className="section doctor-main-grid" ref={modulesSectionRef}>
        <div className="card doctor-schedule-card">
          <h3>Control Plane Modules</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Module</th>
                  <th>Status</th>
                  <th>Connectors</th>
                  <th>Coverage</th>
                  <th>Signals</th>
                  <th>Next Action</th>
                </tr>
              </thead>
              <tbody>
                {controlPlanes.map((row) => (
                  <tr key={row.key}>
                    <td><strong>{row.label}</strong></td>
                    <td><span className={`status-chip status-${tone(row.readiness)}`}>{row.readiness}</span></td>
                    <td>{row.connectors}</td>
                    <td>{row.hospitalCoverage}</td>
                    <td>
                      <div className="muted">
                        {row.transactions30d != null ? `Tx: ${row.transactions30d}` : `Pre-auth: ${row.preauthRequests || 0}`}
                      </div>
                      <div className="muted">
                        {row.successfulCollections30d != null
                          ? `Fail: ${row.failedCollections30d || 0}`
                          : `Approved: ${row.approvedPreauth || 0}`}
                      </div>
                    </td>
                    <td className="muted">{row.nextAction}</td>
                  </tr>
                ))}
                {!controlPlanes.length ? (
                  <tr>
                    <td colSpan={6}>No control plane data yet</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card doctor-alerts-card">
          <h3>Configuration State</h3>
        <div className="alert-stack">
          <div className="alert-item">Mode: {data?.paymentConfig?.mode || "FREE"}</div>
          <div className="alert-item">SHA Credentials: {data?.paymentConfig?.shaConfigured ? "Yes" : "No"}</div>
          <div className="alert-item">eTIMS Credentials: {data?.paymentConfig?.etimsConfigured ? "Yes" : "No"}</div>
          <div className="alert-item">M-PESA Runtime Env: {data?.paymentConfig?.mpesaRuntimeConfigured ? "Yes" : "No"}</div>
          <div className="alert-item">M-PESA Configured: {data?.paymentConfig?.mpesaConfigured ? "Yes" : "No"}</div>
          <div className="alert-item">Stripe Configured: {data?.paymentConfig?.stripeConfigured ? "Yes" : "No"}</div>
          <div className="alert-item">Flutterwave Configured: {data?.paymentConfig?.flutterwaveConfigured ? "Yes" : "No"}</div>
        </div>
      </div>
      </section>

      <section className="section">
        <h3>Partner Runbooks</h3>
        <div className="grid info-grid">
          {controlPlanes.map((row) => (
            <div key={`${row.key}-runbook`} className="card">
              <div className="card-header-actions">
                <h3>{row.label}</h3>
                <span className={`status-chip status-${tone(row.readiness)}`}>{row.readiness}</span>
              </div>
              <div className="alert-stack">
                {(Array.isArray(row.actionPanel) ? row.actionPanel : []).map((step) => (
                  <div key={`${row.key}-${step.label}`} className="alert-item">
                    <strong>{step.label}</strong>
                    <div className={`status-chip status-${step.state === "ready" ? "good" : step.state === "missing" ? "risk" : "warn"}`}>
                      {step.state === "ready" ? "READY" : step.state === "missing" ? "MISSING" : "WATCH"}
                    </div>
                    <div className="muted">{step.note}</div>
                  </div>
                ))}
                <div className="alert-item">
                  <button type="button" className="btn-secondary" onClick={() => navigate("/system-admin/connector-sdk")}>
                    Connector Runtime
                  </button>{" "}
                  <button type="button" className="btn-secondary" onClick={() => navigate("/admin/realtime")}>
                    Live Monitor
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section" ref={credentialsSectionRef}>
        <h3>Government API Credentials</h3>
        <div className="card form">
          <p className="muted">Update SHA and eTIMS API endpoints and tokens from the UI. Changes take effect immediately.</p>
          <div className="ai-inline-actions" style={{ marginBottom: "12px" }}>
            <label className="muted" style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                checked={showOnHover}
                onChange={(e) => saveHoverPreference(e.target.checked)}
              />
              Show secrets on hover
            </label>
          </div>
          <div className="grid info-grid">
            <div>
              <h4>SHA</h4>
              <label>Base URL</label>
              <input
                value={govConfig.sha.baseUrl}
                onChange={(e) => setGovConfig((prev) => ({ ...prev, sha: { ...prev.sha, baseUrl: e.target.value } }))}
                placeholder="https://sha.example.gov"
              />
              <label>Token URL</label>
              <input
                value={govConfig.sha.tokenUrl}
                onChange={(e) => setGovConfig((prev) => ({ ...prev, sha: { ...prev.sha, tokenUrl: e.target.value } }))}
                placeholder="https://sha.example.gov/oauth/token"
              />
              <label>Preauth URL</label>
              <input
                value={govConfig.sha.preauthUrl}
                onChange={(e) => setGovConfig((prev) => ({ ...prev, sha: { ...prev.sha, preauthUrl: e.target.value } }))}
                placeholder="https://sha.example.gov/preauth"
              />
              <label>API Token (optional)</label>
              <div className="password-input-wrap">
                <input
                  type={showSecrets.shaApiToken ? "text" : "password"}
                  value={govConfig.sha.apiToken}
                  onChange={(e) => setGovConfig((prev) => ({ ...prev, sha: { ...prev.sha, apiToken: e.target.value } }))}
                  placeholder="Bearer token"
                  autoComplete="new-password"
                />
                <span
                  role="button"
                  tabIndex={0}
                  className="password-toggle-btn"
                  onClick={() => toggleSecret("shaApiToken")}
                  onMouseEnter={() => hoverSecret("shaApiToken", true)}
                  onMouseLeave={() => hoverSecret("shaApiToken", false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleSecret("shaApiToken");
                    }
                  }}
                  aria-label={showSecrets.shaApiToken ? "Hide token" : "Show token"}
                  title={showSecrets.shaApiToken ? "Hide token" : "Show token"}
                >
                  <EyeIcon open={showSecrets.shaApiToken} />
                </span>
              </div>
              <label>Client ID</label>
              <input
                value={govConfig.sha.clientId}
                onChange={(e) => setGovConfig((prev) => ({ ...prev, sha: { ...prev.sha, clientId: e.target.value } }))}
                placeholder="sha-client-id"
              />
              <label>Client Secret</label>
              <div className="password-input-wrap">
                <input
                  type={showSecrets.shaClientSecret ? "text" : "password"}
                  value={govConfig.sha.clientSecret}
                  onChange={(e) => setGovConfig((prev) => ({ ...prev, sha: { ...prev.sha, clientSecret: e.target.value } }))}
                  placeholder="sha-client-secret"
                  autoComplete="new-password"
                />
                <span
                  role="button"
                  tabIndex={0}
                  className="password-toggle-btn"
                  onClick={() => toggleSecret("shaClientSecret")}
                  onMouseEnter={() => hoverSecret("shaClientSecret", true)}
                  onMouseLeave={() => hoverSecret("shaClientSecret", false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleSecret("shaClientSecret");
                    }
                  }}
                  aria-label={showSecrets.shaClientSecret ? "Hide secret" : "Show secret"}
                  title={showSecrets.shaClientSecret ? "Hide secret" : "Show secret"}
                >
                  <EyeIcon open={showSecrets.shaClientSecret} />
                </span>
              </div>
              <label>Audience</label>
              <input
                value={govConfig.sha.audience}
                onChange={(e) => setGovConfig((prev) => ({ ...prev, sha: { ...prev.sha, audience: e.target.value } }))}
                placeholder="sha-api"
              />
              <label>Timeout (ms)</label>
              <input
                value={govConfig.sha.timeoutMs}
                onChange={(e) => setGovConfig((prev) => ({ ...prev, sha: { ...prev.sha, timeoutMs: e.target.value } }))}
                placeholder="8000"
              />
            </div>
            <div>
              <h4>eTIMS</h4>
              <label>Base URL</label>
              <input
                value={govConfig.etims.baseUrl}
                onChange={(e) => setGovConfig((prev) => ({ ...prev, etims: { ...prev.etims, baseUrl: e.target.value } }))}
                placeholder="https://etims.kra.go.ke"
              />
              <label>Token URL</label>
              <input
                value={govConfig.etims.tokenUrl}
                onChange={(e) => setGovConfig((prev) => ({ ...prev, etims: { ...prev.etims, tokenUrl: e.target.value } }))}
                placeholder="https://etims.kra.go.ke/oauth/token"
              />
              <label>Invoice URL</label>
              <input
                value={govConfig.etims.invoiceUrl}
                onChange={(e) => setGovConfig((prev) => ({ ...prev, etims: { ...prev.etims, invoiceUrl: e.target.value } }))}
                placeholder="https://etims.kra.go.ke/invoices"
              />
              <label>API Key (optional)</label>
              <div className="password-input-wrap">
                <input
                  type={showSecrets.etimsApiKey ? "text" : "password"}
                  value={govConfig.etims.apiKey}
                  onChange={(e) => setGovConfig((prev) => ({ ...prev, etims: { ...prev.etims, apiKey: e.target.value } }))}
                  placeholder="etims-api-key"
                  autoComplete="new-password"
                />
                <span
                  role="button"
                  tabIndex={0}
                  className="password-toggle-btn"
                  onClick={() => toggleSecret("etimsApiKey")}
                  onMouseEnter={() => hoverSecret("etimsApiKey", true)}
                  onMouseLeave={() => hoverSecret("etimsApiKey", false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleSecret("etimsApiKey");
                    }
                  }}
                  aria-label={showSecrets.etimsApiKey ? "Hide key" : "Show key"}
                  title={showSecrets.etimsApiKey ? "Hide key" : "Show key"}
                >
                  <EyeIcon open={showSecrets.etimsApiKey} />
                </span>
              </div>
              <label>API Token (optional)</label>
              <div className="password-input-wrap">
                <input
                  type={showSecrets.etimsApiToken ? "text" : "password"}
                  value={govConfig.etims.apiToken}
                  onChange={(e) => setGovConfig((prev) => ({ ...prev, etims: { ...prev.etims, apiToken: e.target.value } }))}
                  placeholder="etims-api-token"
                  autoComplete="new-password"
                />
                <span
                  role="button"
                  tabIndex={0}
                  className="password-toggle-btn"
                  onClick={() => toggleSecret("etimsApiToken")}
                  onMouseEnter={() => hoverSecret("etimsApiToken", true)}
                  onMouseLeave={() => hoverSecret("etimsApiToken", false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleSecret("etimsApiToken");
                    }
                  }}
                  aria-label={showSecrets.etimsApiToken ? "Hide token" : "Show token"}
                  title={showSecrets.etimsApiToken ? "Hide token" : "Show token"}
                >
                  <EyeIcon open={showSecrets.etimsApiToken} />
                </span>
              </div>
              <label>Client ID</label>
              <input
                value={govConfig.etims.clientId}
                onChange={(e) => setGovConfig((prev) => ({ ...prev, etims: { ...prev.etims, clientId: e.target.value } }))}
                placeholder="etims-client-id"
              />
              <label>Client Secret</label>
              <div className="password-input-wrap">
                <input
                  type={showSecrets.etimsClientSecret ? "text" : "password"}
                  value={govConfig.etims.clientSecret}
                  onChange={(e) => setGovConfig((prev) => ({ ...prev, etims: { ...prev.etims, clientSecret: e.target.value } }))}
                  placeholder="etims-client-secret"
                  autoComplete="new-password"
                />
                <span
                  role="button"
                  tabIndex={0}
                  className="password-toggle-btn"
                  onClick={() => toggleSecret("etimsClientSecret")}
                  onMouseEnter={() => hoverSecret("etimsClientSecret", true)}
                  onMouseLeave={() => hoverSecret("etimsClientSecret", false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleSecret("etimsClientSecret");
                    }
                  }}
                  aria-label={showSecrets.etimsClientSecret ? "Hide secret" : "Show secret"}
                  title={showSecrets.etimsClientSecret ? "Hide secret" : "Show secret"}
                >
                  <EyeIcon open={showSecrets.etimsClientSecret} />
                </span>
              </div>
              <label>Timeout (ms)</label>
              <input
                value={govConfig.etims.timeoutMs}
                onChange={(e) => setGovConfig((prev) => ({ ...prev, etims: { ...prev.etims, timeoutMs: e.target.value } }))}
                placeholder="8000"
              />
            </div>
          </div>
          <button type="button" className="btn-primary" onClick={saveGovConfig} disabled={govSaving}>
            {govSaving ? "Saving..." : "Save Government API Settings"}
          </button>
        </div>
      </section>

      <section className="section">
        <h3>Payment Rail Performance</h3>
        <div className="card">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Total</th>
                  <th>Success</th>
                  <th>Pending</th>
                  <th>Failed</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {providers.map((row) => (
                  <tr key={row.provider}>
                    <td>{row.provider}</td>
                    <td>{row.totalTransactions}</td>
                    <td>{row.successful}</td>
                    <td>{row.pending}</td>
                    <td>{row.failed}</td>
                    <td>KES {Number(row.totalAmount || 0).toLocaleString()}</td>
                  </tr>
                ))}
                {!providers.length ? (
                  <tr>
                    <td colSpan={6}>No payment provider activity yet</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
        </>
      ) : null}
    </div>
  );
}
