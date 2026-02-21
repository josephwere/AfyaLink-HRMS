import React, {useEffect, useState} from 'react';
import { apiFetch } from '../../services/api';

export default function DLQInspectEdit(){
  const [items,setItems]=useState([]);
  const [selected,setSelected]=useState(null);
  const [editData,setEditData]=useState('');

  useEffect(()=>load(),[]);

  async function load(){
    const r = await apiFetch('/api/integrations/dlq-inspect');
    const js = await r.json();
    setItems(js);
  }

  async function view(id){
    const r = await apiFetch('/api/integrations/dlq-inspect/' + id);
    const js = await r.json();
    setSelected(js);
    setEditData(JSON.stringify(js.data, null, 2));
  }

  async function save(){
    try{
      const payload = JSON.parse(editData);
      const r = await apiFetch('/api/integrations/dlq-inspect/' + selected.id, { method:'PUT', body: { data: payload } });
      const js = await r.json();
      alert(JSON.stringify(js));
      load();
    }catch(e){ alert('Invalid JSON'); }
  }

  async function retry(){
    const r = await apiFetch('/api/integrations/dlq-inspect/' + selected.id + '/retry', { method:'POST' });
    const js = await r.json();
    alert(JSON.stringify(js));
    load();
  }

  return (<div><h2>DLQ Inspect & Edit</h2><div style={{display:'flex',gap:12}}><div style={{flex:1}}><button onClick={load}>Refresh</button>{items.map(it=>(<div key={it.id} style={{padding:8,border:'1px solid #333',margin:8}}><div>ID: {it.id}</div><div>Reason: {it.failedReason}</div><button onClick={()=>view(it.id)}>View</button></div>))}</div><div style={{flex:2}}>{selected? (<div><h3>Editing {selected.id}</h3><textarea value={editData} onChange={e=>setEditData(e.target.value)} style={{width:'100%',height:300}}></textarea><div><button onClick={save}>Save</button><button onClick={retry}>Retry</button></div></div>) : <div>Select item to edit</div>}</div></div></div>);
}
