import React, { useState } from "react";
import { useOfflineOps } from "../../hooks/useOfflineOps";

export default function OfflineOps() {
  const [hours, setHours] = useState(72);
  const [q, setQ] = useState("");
  const {
    filtersRef,
    moduleTableRef,
    clientSignalsRef,
    loading,
    server,
    queueStatus,
    local,
    err,
    load,
    moduleRows,
  } = useOfflineOps({ hours, q });

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Offline Operations Monitor</h2>
          <p className="muted">
            Queue health for low-connectivity hospitals: pending writes, delivery failures, and last sync recency.
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
          <div className="card kpi-card-clickable" role="button" tabIndex={0} onClick={() => clientSignalsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); clientSignalsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); } }}><h3>Tracked Clients</h3><p>{server?.summary?.clients ?? 0}</p></div>
          <div className="card kpi-card-clickable" role="button" tabIndex={0} onClick={() => moduleTableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); moduleTableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); } }}><h3>Pending Actions</h3><p>{server?.summary?.pendingQueued ?? 0}</p></div>
          <div className="card kpi-card-clickable" role="button" tabIndex={0} onClick={() => moduleTableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); moduleTableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); } }}><h3>Delivery Failures</h3><p>{server?.summary?.retryFailures ?? 0}</p></div>
          <div className="card kpi-card-clickable" role="button" tabIndex={0} onClick={() => clientSignalsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); clientSignalsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); } }}><h3>Last Sync (Any)</h3><p>{server?.summary?.lastSyncAt ? new Date(server.summary.lastSyncAt).toLocaleString() : "-"}</p></div>
          <div className="card kpi-card-clickable" role="button" tabIndex={0} onClick={() => filtersRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); filtersRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); } }}><h3>Server Queue</h3><p>{queueStatus?.counts?.integrationQueue ?? 0}</p></div>
          <div className="card kpi-card-clickable" role="button" tabIndex={0} onClick={() => filtersRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); filtersRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); } }}><h3>DLQ</h3><p>{queueStatus?.counts?.dlq ?? 0}</p></div>
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card" ref={filtersRef}>
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
        <div className="card doctor-schedule-card" ref={moduleTableRef}>
          <h3>Pending By Module</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Module</th>
                  <th>Pending</th>
                  <th>Delivery Failures</th>
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

        <div className="card doctor-alerts-card" ref={clientSignalsRef}>
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
