import React, {useEffect, useState} from 'react';
import { apiFetch } from '../../services/api';

export default function DLQInspector(){
  const [items,setItems]=useState([]);
  useEffect(()=>{ load(); },[]);
  async function load(){ const r = await apiFetch('/api/integrations/dlq'); const js = await r.json(); setItems(js); }
  async function retry(id){ const r = await apiFetch('/api/integrations/dlq/' + id + '/retry', { method:'POST' }); const js = await r.json(); alert(JSON.stringify(js)); load(); }
  return (<div><h2>Dead Letter Queue</h2><button onClick={load}>Refresh</button><table style={{width:'100%'}}><thead><tr><th>ID</th><th>Reason</th><th>Data</th><th>Action</th></tr></thead><tbody>{items.map(it=>(<tr key={it.id}><td>{it.id}</td><td>{it.failedReason}</td><td><pre>{JSON.stringify(it.data)}</pre></td><td><button onClick={()=>retry(it.id)}>Retry</button></td></tr>))}</tbody></table></div>); }
