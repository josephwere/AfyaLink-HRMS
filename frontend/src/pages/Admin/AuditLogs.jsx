import { useEffect, useState } from "react";
import { fetchAuditLogs } from "../../services/auditApi";

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [filters, setFilters] = useState({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await fetchAuditLogs(filters);
    setLogs(res.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const exportCSV = () => {
    const rows = logs.map((l) => ({
      time: new Date(l.createdAt).toISOString(),
      actor: l.actorId?.email,
      action: l.action,
      resource: l.resource,
      success: l.success,
      ip: l.ip,
    }));

    const csv =
      "time,actor,action,resource,success,ip\n" +
      rows.map((r) => Object.values(r).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "audit-logs.csv";
    a.click();
  };

  return (
    <div className="card">
      <h2>🧾 Audit Logs</h2>

      <div className="row">
        <input
          placeholder="Action"
          onChange={(e) =>
            setFilters({ ...filters, action: e.target.value })
          }
        />
        <input
          placeholder="Resource"
          onChange={(e) =>
            setFilters({ ...filters, resource: e.target.value })
          }
        />
        <button onClick={load}>Filter</button>
        <button onClick={exportCSV}>Export CSV</button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Resource</th>
              <th>Success</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l._id}>
                <td>{new Date(l.createdAt).toLocaleString()}</td>
                <td>{l.actorId?.email}</td>
                <td>{l.action}</td>
                <td>{l.resource}</td>
                <td>{l.success ? "✅" : "❌"}</td>
                <td>{l.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
