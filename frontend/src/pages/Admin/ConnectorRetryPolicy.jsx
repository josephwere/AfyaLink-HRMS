import React, {useEffect, useState} from 'react';
import apiFetch from '../../utils/apiFetch';

export default function ConnectorRetryPolicy(){
  const [connectors,setConnectors]=useState([]);
  const [sel,setSel]=useState('');
  const [policy,setPolicy]=useState({ attempts:5, backoffDelay:1000, backoffType:'exponential' });
  const [msg, setMsg] = useState("");

  useEffect(()=>{ load(); },[]);
  async function load(){
    try {
      const js = await apiFetch('/api/connectors');
      setConnectors(Array.isArray(js) ? js : Array.isArray(js?.items) ? js.items : []);
    } catch (e) {
      setMsg(e?.message || "Failed to load connectors");
      setConnectors([]);
    }
  }
  async function save(){
    if(!sel) return setMsg('Select connector');
    try {
      const js = await apiFetch('/api/integrations/dlq/connector/' + sel + '/retry-policy', { method:'POST', body: policy });
      setMsg(JSON.stringify(js));
    } catch (e) {
      setMsg(e?.message || "Failed to save policy");
    }
  }

  return (
    <div className="dashboard">
      <h2>Connector Retry Policies</h2>
      <div className="card form">
        <select value={sel} onChange={e=>setSel(e.target.value)}>
          <option value=''>Select</option>
          {connectors.map(c => (<option key={c._id} value={c._id}>{c.name}</option>))}
        </select>
        <div><label>Attempts</label><input type='number' value={policy.attempts} onChange={e=>setPolicy(p=>({...p,attempts: Number(e.target.value)}))} /></div>
        <div><label>Backoff Delay (ms)</label><input type='number' value={policy.backoffDelay} onChange={e=>setPolicy(p=>({...p,backoffDelay: Number(e.target.value)}))} /></div>
        <div><label>Backoff Type</label><select value={policy.backoffType} onChange={e=>setPolicy(p=>({...p,backoffType:e.target.value}))}><option value='exponential'>exponential</option><option value='fixed'>fixed</option></select></div>
        <div><button type="button" className="btn-primary" onClick={save}>Save Policy</button></div>
      </div>
      {msg ? <p className="muted">{msg}</p> : null}
    </div>
  );
}
