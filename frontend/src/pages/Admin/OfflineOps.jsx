import React, { useEffect, useMemo, useState } from "react";
import { getOfflineMetricsSnapshot } from "../../utils/offlineQueue";
import { getOfflineOpsMetrics, getOfflineQueueStatus } from "../../services/offlineOpsApi";

export default function OfflineOps() {
  const [loading, setLoading] = useState(false);
  const [hours, setHours] = useState(72);
  const [q, setQ] = useState("");
  const [server, setServer] = useState(null);
  const [queueStatus, setQueueStatus] = useState(null);
  const [local, setLocal] = useState(getOfflineMetricsSnapshot());
  const [err, setErr] = useState("");

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const [metrics, status] = await Promise.all([
        getOfflineOpsMetrics({ hours, q, limit: 150 }),
        getOfflineQueueStatus().catch(() => null),
      ]);
      setServer(metrics || null);
      setQueueStatus(status || null);
      setLocal(getOfflineMetricsSnapshot());
    } catch (e) {
      setErr(String(e?.message || "Failed to load offline metrics"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const onUpdate = (ev) => setLocal(ev?.detail || getOfflineMetricsSnapshot());
    window.addEventListener("afyalink:offline-metrics-updated", onUpdate);
    const timer = setInterval(load, 30000);
    return () => {
      window.removeEventListener("afyalink:offline-metrics-updated", onUpdate);
      clearInterval(timer);
    };
  }, [hours, q]);

  const moduleRows = useMemo(() => server?.byModule || [], [server]);

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Offline Operations Monitor</h2>
          <p className="muted">
            Queue health for low-connectivity hospitals: pending writes, retry failures, and sync recency.
          </p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {err ? (
        <section className="section">
          <div className="card"><p className="muted">{err}</p></div>
        </section>
      ) : null}

      <section className="section">
        <div className="grid info-grid">
          <div className="card"><h3>Tracked Clients</h3><p>{server?.summary?.clients ?? 0}</p></div>
          <div className="card"><h3>Pending Actions</h3><p>{server?.summary?.pendingQueued ?? 0}</p></div>
          <div className="card"><h3>Retry Failures</h3><p>{server?.summary?.retryFailures ?? 0}</p></div>
          <div className="card"><h3>Last Sync (Any)</h3><p>{server?.summary?.lastSyncAt ? new Date(server.summary.lastSyncAt).toLocaleString() : "-"}</p></div>
          <div className="card"><h3>Server Queue</h3><p>{queueStatus?.counts?.integrationQueue ?? 0}</p></div>
          <div className="card"><h3>DLQ</h3><p>{queueStatus?.counts?.dlq ?? 0}</p></div>
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card">
          <h3>Filters</h3>
          <div className="grid info-grid">
            <label>
              <span className="muted">Lookback (hours)</span>
              <input type="number" min={1} max={720} value={hours} onChange={(e) => setHours(Number(e.target.value || 72))} />
            </label>
            <label>
              <span className="muted">Search User/Hospital</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Hospital or user name/email" />
            </label>
            <button type="button" className="btn-primary" onClick={load} disabled={loading}>Apply</button>
          </div>
        </div>

        <div className="card">
          <h3>This Device (Local)</h3>
          <div className="alert-stack">
            <div className="alert-item">Queue Length: {local?.queueLength ?? 0}</div>
            <div className="alert-item">Enqueued Lifetime: {local?.lifetime?.enqueued ?? 0}</div>
            <div className="alert-item">Synced Lifetime: {local?.lifetime?.synced ?? 0}</div>
            <div className="alert-item">Failed Lifetime: {local?.lifetime?.failed ?? 0}</div>
            <div className="alert-item">Last Sync: {local?.lastSyncAt ? new Date(local.lastSyncAt).toLocaleString() : "-"}</div>
          </div>
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <h3>Pending By Module</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Module</th>
                  <th>Pending</th>
                  <th>Retry Failures</th>
                  <th>Clients</th>
                  <th>Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {moduleRows.map((m) => (
                  <tr key={m.module}>
                    <td>{m.module}</td>
                    <td>{m.pending}</td>
                    <td>{m.retryFailures}</td>
                    <td>{m.clients}</td>
                    <td>{m.lastSeenAt ? new Date(m.lastSeenAt).toLocaleString() : "-"}</td>
                  </tr>
                ))}
                {!moduleRows.length ? <tr><td colSpan={5}>No module data</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card doctor-alerts-card">
          <h3>Client Signals</h3>
          <div className="alert-stack">
            {(server?.clients || []).slice(0, 20).map((c) => (
              <div key={c.id} className="alert-item">
                {(c.userName || "Unknown user")} • {(c.hospitalName || "Unassigned")} • pending {c.queueLength} • failed {c.failedTotal}
              </div>
            ))}
            {!server?.clients?.length ? <div className="alert-item">No active client metrics</div> : null}
          </div>
        </div>
      </section>
    </div>
  );
}

