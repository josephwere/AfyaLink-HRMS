import React from 'react';
import useDLQInspectEdit from '../../hooks/useDLQInspectEdit';

export default function DLQInspectEdit(){
  const { items, selected, editData, setEditData, load, view, save, retry } = useDLQInspectEdit();

  return (
    <div className="dashboard">
      <h2>Queue Item Inspector</h2>
      <div className="grid info-grid" style={{ gap: 12 }}>
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
                <button type="button" className="btn-secondary" onClick={retry}>Re-run</button>
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
