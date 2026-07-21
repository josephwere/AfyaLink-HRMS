import { useAuditLogs } from "../../hooks/useAuditLogs";

export default function AuditLogs() {
  const { logs, filters, setFilters, loading, load, exportCSV, exportEvidenceBundle } = useAuditLogs();

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
        <button type="button" onClick={load}>Filter</button>
        <button type="button" onClick={exportCSV}>Export CSV</button>
        <button type="button" onClick={exportEvidenceBundle}>Export Evidence Bundle</button>
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
