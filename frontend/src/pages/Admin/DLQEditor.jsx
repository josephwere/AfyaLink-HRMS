import React, {useEffect, useState} from 'react';
import { apiFetch } from '../../services/api';

export default function DLQEditor(){
  const [items,setItems]=useState([]);
  const [selected,setSelected]=useState(null);
  const [payload,setPayload]=useState('');

  useEffect(()=>{ load(); },[]);

  async function load(){ const r = await apiFetch('/api/integrations/dlq'); const js = await r.json(); setItems(js); }
  async function view(id){
    const r = await apiFetch('/api/integrations/dlq/' + id); const js = await r.json();
    setSelected(js); setPayload(JSON.stringify(js.data, null, 2));
  }
  async function saveAndRetry(id){
    try{
      const newData = JSON.parse(payload);
      const r = await apiFetch('/api/integrations/dlq/' + id + '/edit-retry', { method:'POST', body: { newData } });
      const js = await r.json();
      alert(JSON.stringify(js));
      load();
      setSelected(null);
    }catch(e){ alert('Invalid JSON: ' + e.message); }
  }

  return (<div><h2>DLQ Editor</h2><div style={{display:'flex',gap:12}}>
    <div style={{width:320}}><button onClick={load}>Refresh</button>{items.map(it=>(<div key={it.id} style={{padding:8,margin:8,background:'#fff1'}}><div>ID: {it.id}</div><div>Reason: {it.failedReason}</div><button onClick={()=>view(it.id)}>View/Edit</button></div>))}</div>
    <div style={{flex:1}}>{selected? (<div><h3>Editing {selected.id}</h3><textarea style={{width:'100%',height:400}} value={payload} onChange={e=>setPayload(e.target.value)}></textarea><div><button onClick={()=>saveAndRetry(selected.id)}>Save & Retry</button></div></div>) : (<div>Select an item to edit</div>)}</div>
  </div></div>);
}
