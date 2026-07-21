import React from 'react';
import { useIntegrationsLogs } from "../../hooks/useIntegrationsLogs";

export default function IntegrationsLogs(){
  const { logs, loading, error } = useIntegrationsLogs();
  return (
    <div className="dashboard">
      <h2>Integration Logs</h2>
      <div className="card">
        {error ? <p className="muted">{error}</p> : null}
        {loading ? <p className="muted">Loading...</p> : null}
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l._id}>
                  <td>{new Date(l.createdAt).toLocaleString()}</td>
                  <td>{l.action}</td>
                  <td><pre>{JSON.stringify(l.details, null, 2)}</pre></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
