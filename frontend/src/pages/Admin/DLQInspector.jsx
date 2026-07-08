import React from 'react';
import useDLQInspector from '../../hooks/useDLQInspector';

export default function DLQInspector(){
  const { items, msg, load, retry } = useDLQInspector();

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Failed Deliveries</h2>
          <p className="muted">Inspect failed events and reprocess safely.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-secondary" onClick={load}>Refresh</button>
        </div>
      </div>
      {msg ? <div className="card">{msg}</div> : null}
      <div className="card">
        <div className="table-wrap">
          <table className="table lite">
            <thead><tr><th>ID</th><th>Reason</th><th>Payload</th><th>Action</th></tr></thead>
            <tbody>
              {items.map(it=>(
                <tr key={it.id}>
                  <td>{it.id}</td>
                  <td>{it.failedReason}</td>
                  <td className="muted">Stored</td>
                  <td><button type="button" className="btn-secondary" onClick={()=>retry(it.id)}>Re-run</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
