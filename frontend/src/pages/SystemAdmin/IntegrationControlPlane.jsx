import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { getIntegrationControlPlane } from "../../services/systemAdminApi";

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

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getIntegrationControlPlane();
      setData(res || null);
    } catch (err) {
      setError(err?.message || "Failed to load integration control plane");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

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
          <button type="button" className="btn-primary" onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {error ? <div className="card">{error}</div> : null}

      <section className="section">
        <h3>Rollout Snapshot</h3>
        <div className="grid info-grid">
          <StatCard title="Hospitals With Payments" value={data?.summary?.paymentEnabledHospitals ?? 0} />
          <StatCard title="SHA Coverage" value={data?.summary?.shaCoverageHospitals ?? 0} />
          <StatCard title="M-PESA Coverage" value={data?.summary?.mpesaCoverageHospitals ?? 0} />
          <StatCard title="Overdue Invoices" value={data?.summary?.overdueInvoices ?? 0} />
          <StatCard title="Transactions 30d" value={data?.summary?.totalTransactions30d ?? 0} />
          <StatCard title="Succeeded 30d" value={data?.summary?.succeededTransactions30d ?? 0} />
        </div>
      </section>

      <section className="section doctor-main-grid">
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
    </div>
  );
}
