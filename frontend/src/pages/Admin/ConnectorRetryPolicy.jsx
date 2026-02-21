import React, {useEffect, useState} from 'react';
import { apiFetch } from '../../services/api';

export default function ConnectorRetryPolicy(){
  const [connectors,setConnectors]=useState([]);
  const [sel,setSel]=useState('');
  const [policy,setPolicy]=useState({ attempts:5, backoffDelay:1000, backoffType:'exponential' });

  useEffect(()=>{ load(); },[]);
  async function load(){ const r = await apiFetch('/api/connectors'); const js = await r.json(); setConnectors(js); }
  async function save(){ if(!sel) return alert('select connector'); const r = await apiFetch('/api/integrations/dlq/connector/' + sel + '/retry-policy', { method:'POST', body: policy }); const js = await r.json(); alert(JSON.stringify(js)); }

  return (<div><h2>Connector Retry Policies</h2>
    <select value={sel} onChange={e=>setSel(e.target.value)}><option value=''>Select</option>{connectors.map(c=>(<option key={c._id} value={c._id}>{c.name}</option>))}</select>
    <div><label>Attempts</label><input type='number' value={policy.attempts} onChange={e=>setPolicy(p=>({...p,attempts: Number(e.target.value)}))} /></div>
    <div><label>Backoff Delay (ms)</label><input type='number' value={policy.backoffDelay} onChange={e=>setPolicy(p=>({...p,backoffDelay: Number(e.target.value)}))} /></div>
    <div><label>Backoff Type</label><select value={policy.backoffType} onChange={e=>setPolicy(p=>({...p,backoffType:e.target.value}))}><option value='exponential'>exponential</option><option value='fixed'>fixed</option></select></div>
    <button onClick={save}>Save Policy</button>
  </div>);
}
