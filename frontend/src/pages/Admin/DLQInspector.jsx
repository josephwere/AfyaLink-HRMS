import React, {useEffect, useState} from 'react';
import apiFetch from '../../utils/apiFetch';

export default function DLQInspector(){
  const [items,setItems]=useState([]);
  useEffect(()=>{ load(); },[]);
  async function load(){
    const js = await apiFetch('/api/integrations/dlq');
    setItems(Array.isArray(js) ? js : Array.isArray(js?.items) ? js.items : []);
  }
  async function retry(id){
    const js = await apiFetch('/api/integrations/dlq/' + id + '/retry', { method:'POST' });
    alert(JSON.stringify(js));
    load();
  }
  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Dead Letter Queue</h2>
          <p className="muted">Inspect failed events and retry safely.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-secondary" onClick={load}>Refresh</button>
        </div>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table className="table lite">
            <thead><tr><th>ID</th><th>Reason</th><th>Data</th><th>Action</th></tr></thead>
            <tbody>
              {items.map(it=>(
                <tr key={it.id}>
                  <td>{it.id}</td>
                  <td>{it.failedReason}</td>
                  <td><pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(it.data)}</pre></td>
                  <td><button type="button" className="btn-secondary" onClick={()=>retry(it.id)}>Retry</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
