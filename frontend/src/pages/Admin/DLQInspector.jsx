import React, {useEffect, useState} from 'react';
import apiFetch from '../../utils/apiFetch';

export default function DLQInspector(){
  const [items,setItems]=useState([]);
  const [msg, setMsg] = useState("");
  useEffect(()=>{ load(); },[]);
  async function load(){
    setMsg("");
    const js = await apiFetch('/api/integrations/dlq');
    setItems(Array.isArray(js) ? js : Array.isArray(js?.items) ? js.items : []);
  }
  async function retry(id){
    setMsg("");
    try {
      await apiFetch('/api/integrations/dlq/' + id + '/retry', { method:'POST' });
      setMsg("Queued for reprocessing.");
      load();
    } catch (e) {
      setMsg(e?.message || "Could not reprocess this item.");
    }
  }
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
