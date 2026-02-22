import React, {useEffect, useState} from 'react';
import apiFetch from '../../utils/apiFetch';

export default function DLQInspectEdit(){
  const [items,setItems]=useState([]);
  const [selected,setSelected]=useState(null);
  const [editData,setEditData]=useState('');

  useEffect(() => {
    load();
  }, []);

  const asList = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.data)) return data.data;
    return [];
  };

  async function load(){
    const js = await apiFetch('/api/integrations/dlq-inspect');
    setItems(asList(js));
  }

  async function view(id){
    const js = await apiFetch('/api/integrations/dlq-inspect/' + id);
    setSelected(js);
    setEditData(JSON.stringify(js.data, null, 2));
  }

  async function save(){
    try{
      const payload = JSON.parse(editData);
      const js = await apiFetch('/api/integrations/dlq-inspect/' + selected.id, { method:'PUT', body: { data: payload } });
      alert(JSON.stringify(js));
      load();
    }catch(e){ alert('Invalid JSON'); }
  }

  async function retry(){
    const js = await apiFetch('/api/integrations/dlq-inspect/' + selected.id + '/retry', { method:'POST' });
    alert(JSON.stringify(js));
    load();
  }

  return (
    <div>
      <h2>DLQ Inspect & Edit</h2>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 12 }}>
        <div className="card">
          <button type="button" className="btn-secondary" onClick={load}>Refresh</button>
          {items.map((it) => (
            <div key={it.id} style={{padding:8,border:'1px solid #333',margin:8}}>
              <div>ID: {it.id}</div>
              <div>Reason: {it.failedReason}</div>
              <button type="button" className="btn-secondary" onClick={()=>view(it.id)}>View</button>
            </div>
          ))}
        </div>
        <div className="card">
          {selected ? (
            <div>
              <h3>Editing {selected.id}</h3>
              <textarea value={editData} onChange={e=>setEditData(e.target.value)} style={{width:'100%',height:300}} />
              <div className="welcome-actions mt-10">
                <button type="button" className="btn-primary" onClick={save}>Save</button>
                <button type="button" className="btn-secondary" onClick={retry}>Retry</button>
              </div>
            </div>
          ) : (
            <div>Select item to edit</div>
          )}
        </div>
      </div>
    </div>
  );
}
