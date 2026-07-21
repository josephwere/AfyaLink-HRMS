import { useSreIncidentOps } from "../../hooks/useSreIncidentOps";

export default function SreIncidentOps() {
  const {
    items,
    loading,
    busyId,
    message,
    q,
    setQ,
    status,
    setStatus,
    severity,
    setSeverity,
    form,
    setForm,
    load,
    submit,
    runAction,
    ackIncident,
    escalateIncident,
    mitigateIncident,
    resolveIncident,
    exportCsv,
  } = useSreIncidentOps();

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>SRE Incidents</h2>
          <p className="muted">Declare, acknowledge, mitigate and resolve production incidents.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button type="button" className="btn-secondary" onClick={exportCsv} disabled={!items.length}>
            Export CSV
          </button>
        </div>
      </div>

      {message ? (
        <section className="section">
          <div className="card"><p className="muted">{message}</p></div>
        </section>
      ) : null}

      <section className="section">
        <div className="card">
          <h3>Declare Incident</h3>
          <form className="form-grid" onSubmit={submit}>
            <label>
              Severity
              <select value={form.severity} onChange={(e) => setForm((p) => ({ ...p, severity: e.target.value }))}>
                <option value="SEV1">SEV1</option>
                <option value="SEV2">SEV2</option>
                <option value="SEV3">SEV3</option>
                <option value="SEV4">SEV4</option>
              </select>
            </label>
            <label>
              Service
              <input value={form.service} onChange={(e) => setForm((p) => ({ ...p, service: e.target.value }))} />
            </label>
            <label>
              Source Alert
              <input value={form.sourceAlert} onChange={(e) => setForm((p) => ({ ...p, sourceAlert: e.target.value }))} />
            </label>
            <label>
              Runbook URL
              <input value={form.runbookUrl} onChange={(e) => setForm((p) => ({ ...p, runbookUrl: e.target.value }))} />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Summary
              <textarea value={form.summary} onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))} />
            </label>
            <button type="submit" className="btn primary" disabled={busyId === "create"}>
              {busyId === "create" ? "Saving..." : "Declare Incident"}
            </button>
          </form>
        </div>
      </section>

      <section className="section">
        <div className="card">
          <h3>Incident Queue</h3>
          <div className="form-row">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search key/summary/alert" />
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All status</option>
              <option value="OPEN">OPEN</option>
              <option value="ACKED">ACKED</option>
              <option value="MITIGATED">MITIGATED</option>
              <option value="RESOLVED">RESOLVED</option>
            </select>
            <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
              <option value="">All severity</option>
              <option value="SEV1">SEV1</option>
              <option value="SEV2">SEV2</option>
              <option value="SEV3">SEV3</option>
              <option value="SEV4">SEV4</option>
            </select>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Incident</th>
                  <th>Status</th>
                  <th>Severity</th>
                  <th>Summary</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item._id}>
                    <td>{item.incidentKey}</td>
                    <td>{item.status}</td>
                    <td>{item.severity}</td>
                    <td>{item.summary}</td>
                    <td>
                      <div className="form-row">
                        <button type="button" className="btn" disabled={busyId === item._id} onClick={() => ackIncident(item._id)}>Ack</button>
                        <button type="button" className="btn" disabled={busyId === item._id} onClick={() => escalateIncident(item._id)}>Escalate</button>
                        <button type="button" className="btn" disabled={busyId === item._id} onClick={() => mitigateIncident(item._id)}>Mitigate</button>
                        <button type="button" className="btn" disabled={busyId === item._id} onClick={() => resolveIncident(item._id)}>Resolve</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!items.length && (
                  <tr>
                    <td colSpan={5} className="muted">No incidents found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
