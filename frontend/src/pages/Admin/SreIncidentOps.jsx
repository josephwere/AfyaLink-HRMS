import { useEffect, useState } from "react";
import {
  ackSreIncident,
  createSreIncident,
  exportSreIncidentsCsv,
  escalateSreIncident,
  listSreIncidents,
  mitigateSreIncident,
  resolveSreIncident,
} from "../../services/opsApi";

export default function SreIncidentOps() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [severity, setSeverity] = useState("");

  const [form, setForm] = useState({
    severity: "SEV2",
    summary: "",
    sourceAlert: "",
    service: "afyalink-backend",
    runbookUrl: "",
  });

  const load = async () => {
    setLoading(true);
    setMessage("");
    try {
      const data = await listSreIncidents({ q, status, severity, limit: 120 });
      setItems(Array.isArray(data?.incidents) ? data.incidents : []);
    } catch (err) {
      setMessage(err?.message || "Failed to load incidents.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [q, status, severity]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.summary.trim()) {
      setMessage("Summary is required.");
      return;
    }
    setBusyId("create");
    setMessage("");
    try {
      await createSreIncident(form);
      setForm((prev) => ({ ...prev, summary: "", sourceAlert: "" }));
      await load();
      setMessage("Incident declared.");
    } catch (err) {
      setMessage(err?.message || "Failed to create incident.");
    } finally {
      setBusyId("");
    }
  };

  const runAction = async (id, fn, note) => {
    setBusyId(id);
    setMessage("");
    try {
      await fn(id, { note });
      await load();
    } catch (err) {
      setMessage(err?.message || "Incident action failed.");
    } finally {
      setBusyId("");
    }
  };

  const exportCsv = async () => {
    try {
      await exportSreIncidentsCsv({
        q: q || undefined,
        status: status || undefined,
        severity: severity || undefined,
        limit: 10000,
      });
    } catch (err) {
      setMessage(err?.message || "Failed to export incidents CSV.");
    }
  };

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
                        <button type="button" className="btn" disabled={busyId === item._id} onClick={() => runAction(item._id, ackSreIncident, "Acknowledged by operations")}>Ack</button>
                        <button type="button" className="btn" disabled={busyId === item._id} onClick={() => runAction(item._id, escalateSreIncident, "Escalated")}>Escalate</button>
                        <button type="button" className="btn" disabled={busyId === item._id} onClick={() => runAction(item._id, mitigateSreIncident, "Mitigation applied")}>Mitigate</button>
                        <button type="button" className="btn" disabled={busyId === item._id} onClick={() => runAction(item._id, resolveSreIncident, "Resolved")}>Resolve</button>
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
