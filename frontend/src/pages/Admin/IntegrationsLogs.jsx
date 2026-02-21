import React, {useEffect, useState} from 'react';
import { apiFetch } from '../../services/api';

export default function IntegrationsLogs(){
  const [logs,setLogs]=useState([]);
  useEffect(()=>{ load(); },[]);
  async function load(){ const r = await apiFetch('/api/audit?limit=100'); const js = await r.json(); setLogs(js.data || []); }
  return (<div><h2>Integration Logs</h2><table style={{width:'100%'}}><thead><tr><th>Time</th><th>Action</th><th>Details</th></tr></thead><tbody>{logs.map(l=>(<tr key={l._id}><td>{new Date(l.createdAt).toLocaleString()}</td><td>{l.action}</td><td><pre>{JSON.stringify(l.details,null,2)}</pre></td></tr>))}</tbody></table></div>);
}
