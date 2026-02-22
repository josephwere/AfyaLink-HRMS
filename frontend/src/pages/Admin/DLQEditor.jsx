import React, {useEffect, useState} from 'react';
import apiFetch from '../../utils/apiFetch';

export default function DLQEditor(){
  const [items,setItems]=useState([]);
  const [selected,setSelected]=useState(null);
  const [payload,setPayload]=useState('');

  useEffect(()=>{ load(); },[]);

  const asList = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.data)) return data.data;
    return [];
  };

  async function load(){
    const js = await apiFetch('/api/integrations/dlq');
    setItems(asList(js));
  }
  async function view(id){
    const js = await apiFetch('/api/integrations/dlq/' + id);
    setSelected(js); setPayload(JSON.stringify(js.data, null, 2));
  }
  async function saveAndRetry(id){
    try{
      const newData = JSON.parse(payload);
      const js = await apiFetch('/api/integrations/dlq/' + id + '/edit-retry', { method:'POST', body: { newData } });
      alert(JSON.stringify(js));
      load();
      setSelected(null);
    }catch(e){ alert('Invalid JSON: ' + e.message); }
  }

  return (
    <div>
      <h2>DLQ Editor</h2>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 12 }}>
        <div className="card">
          <button type="button" className="btn-secondary" onClick={load}>Refresh</button>
          {items.map((it) => (
            <div key={it.id} style={{padding:8,margin:8,background:'#fff1'}}>
              <div>ID: {it.id}</div>
              <div>Reason: {it.failedReason}</div>
              <button type="button" className="btn-secondary" onClick={()=>view(it.id)}>View/Edit</button>
            </div>
          ))}
        </div>
        <div className="card">
          {selected ? (
            <div>
              <h3>Editing {selected.id}</h3>
              <textarea style={{width:'100%',height:400}} value={payload} onChange={e=>setPayload(e.target.value)} />
              <div style={{ marginTop: 10 }}>
                <button type="button" className="btn-primary" onClick={()=>saveAndRetry(selected.id)}>Save & Retry</button>
              </div>
            </div>
          ) : (
            <div>Select an item to edit</div>
          )}
        </div>
      </div>
    </div>
  );
}
