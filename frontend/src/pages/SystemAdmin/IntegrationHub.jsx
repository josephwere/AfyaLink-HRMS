import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { getIntegrationHubSummary } from "../../services/systemAdminApi";

function statusTone(status) {
  if (status === "READY") return "good";
  if (status === "AT_RISK") return "warn";
  if (status === "DEGRADED") return "risk";
  if (status === "DISABLED") return "warn";
  return "muted";
}

export default function IntegrationHub() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [clientMeta, setClientMeta] = useState(null);
  const prioritySectionRef = useRef(null);
  const inventorySectionRef = useRef(null);
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
      const res = await getIntegrationHubSummary();
      if (requestRef.current !== requestId) return;
      setData(res?.payload || null);
      setClientMeta(res?.clientMeta || null);
    } catch (err) {
      if (requestRef.current !== requestId) return;
      setError(err?.message || "Failed to load integration hub");
      if (!preserveData) setData(null);
    } finally {
      if (requestRef.current === requestId) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load({ preserveData: false });
  }, [load]);

  const hasData = Boolean(data);
  const initialLoading = loading && !hasData;
  const refreshing = loading && hasData;

  const modules = Array.isArray(data?.modules) ? data.modules : [];
  const connectors = Array.isArray(data?.connectors) ? data.connectors : [];
  const freeApis = Array.isArray(data?.freeApis) ? data.freeApis : [];

  const topActions = useMemo(
    () => [
      { label: "Connector Runtime", to: "/system-admin/connector-sdk" },
      { label: "Mapping Studio", to: "/system-admin/mapping-studio" },
      { label: "Integration Monitor", to: "/admin/realtime" },
      { label: "Migration Hub", to: "/system-admin/migrations" },
      { label: "Offline Ops", to: "/admin/offline-ops" },
    ],
    []
  );

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Integration Hub</h2>
          <p className="muted">Government-first connector control for SHA, eTIMS, M-PESA, FHIR, HL7, DICOM, and insurance.</p>
        </div>
        <div className="welcome-actions">
          {topActions.map((action) => (
            <button key={action.to} type="button" className="btn-secondary" onClick={() => navigate(action.to)}>
              {action.label}
            </button>
          ))}
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
            ? "Refreshing live integration posture while the current workspace stays visible."
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
            <strong>Preparing live integration posture</strong>
            <p className="muted">
              We are waking the backend and waiting for the first connector summary so this page
              does not flash a false timeout on cold start.
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

      {hasData ? (
        <>
      <section className="section">
        <h3>Coverage Snapshot</h3>
        <div className="grid info-grid">
          <StatCard title="Total Connectors" value={data?.totals?.totalConnectors ?? 0} onClick={() => scrollToSection(inventorySectionRef)} />
          <StatCard title="Ready Modules" value={data?.totals?.readyModules ?? 0} onClick={() => scrollToSection(prioritySectionRef)} />
          <StatCard title="At Risk" value={data?.totals?.atRiskModules ?? 0} onClick={() => scrollToSection(prioritySectionRef)} />
          <StatCard title="Degraded" value={data?.totals?.degradedModules ?? 0} onClick={() => scrollToSection(prioritySectionRef)} />
          <StatCard title="Missing" value={data?.totals?.missingModules ?? 0} onClick={() => navigate("/system-admin/integration-control-plane")} />
        </div>
      </section>

      <section className="section doctor-main-grid" ref={prioritySectionRef}>
        <div className="card doctor-schedule-card">
          <h3>Priority Integrations</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Integration</th>
                  <th>Status</th>
                  <th>Connectors</th>
                  <th>Modes</th>
                  <th>Last Success</th>
                  <th>Next Action</th>
                </tr>
              </thead>
              <tbody>
                {modules.map((module) => (
                  <tr key={module.key}>
                    <td>
                      <strong>{module.label}</strong>
                      <div className="muted">{module.description}</div>
                    </td>
                    <td>
                      <span className={`status-chip status-${statusTone(module.status)}`}>{module.status}</span>
                    </td>
                    <td>{module.activeConnectorCount}/{module.connectorCount}</td>
                    <td>{Array.isArray(module.runtimeModes) && module.runtimeModes.length ? module.runtimeModes.join(", ") : "—"}</td>
                    <td>{module.latestSuccessAt ? new Date(module.latestSuccessAt).toLocaleString() : "—"}</td>
                    <td className="muted">{module.nextAction}</td>
                  </tr>
                ))}
                {!modules.length ? (
                  <tr>
                    <td colSpan={6}>No integration data yet</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card doctor-alerts-card">
          <h3>Execution Rules</h3>
          <div className="alert-stack">
            <div className="alert-item">Use SHADOW first for every new hospital connector.</div>
            <div className="alert-item">Only move to MIRROR/CUTOVER after stable probe success.</div>
            <div className="alert-item">Keep offline sync healthy before onboarding low-connectivity facilities.</div>
            <div className="alert-item">Treat SHA, eTIMS, and M-PESA as mandatory launch gates for Kenya production.</div>
          </div>
        </div>
      </section>

      <section className="section" ref={inventorySectionRef}>
        <h3>Connector Inventory</h3>
        <div className="card">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Profile</th>
                  <th>Mode</th>
                  <th>Last Sync</th>
                  <th>Health</th>
                </tr>
              </thead>
              <tbody>
                {connectors.map((connector) => {
                  const healthy =
                    connector?.runtime?.lastSuccessAt &&
                    (!connector?.runtime?.lastErrorAt ||
                      new Date(connector.runtime.lastSuccessAt) >= new Date(connector.runtime.lastErrorAt));
                  return (
                    <tr key={connector._id}>
                      <td>{connector.name}</td>
                      <td>{String(connector.type || "").toUpperCase()}</td>
                      <td>{connector.profile || "—"}</td>
                      <td>{connector?.runtime?.mode || "SHADOW"}</td>
                      <td>{connector.lastSync ? new Date(connector.lastSync).toLocaleString() : "—"}</td>
                      <td>{healthy ? "Healthy" : connector?.isActive === false ? "Disabled" : "Needs probe"}</td>
                    </tr>
                  );
                })}
                {!connectors.length ? (
                  <tr>
                    <td colSpan={6}>No connectors configured</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section">
        <h3>Free & Sandbox APIs (Required)</h3>
        <div className="card">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Provider</th>
                  <th>Base URL</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {freeApis.flatMap((group) =>
                  (group.providers || []).map((provider) => (
                    <tr key={`${group.key}-${provider.name}`}>
                      <td>{group.label}</td>
                      <td>{provider.name}</td>
                      <td className="mono">{provider.baseUrl || "—"}</td>
                      <td className="muted">{provider.note || "—"}</td>
                    </tr>
                  ))
                )}
                {!freeApis.length ? (
                  <tr>
                    <td colSpan={4}>No free API catalog configured.</td>
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
