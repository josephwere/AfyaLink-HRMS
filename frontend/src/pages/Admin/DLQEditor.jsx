import React from 'react';
import useDLQEditor from '../../hooks/useDLQEditor';

export default function DLQEditor(){
  const { items, selected, payload, setPayload, load, view, saveAndRetry } = useDLQEditor();

  return (
    <div className="dashboard">
      <h2>Queue Replay</h2>
      <div className="grid info-grid" style={{ gap: 12 }}>
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
                <button type="button" className="btn-primary" onClick={()=>saveAndRetry(selected.id)}>Save & Re-run</button>
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
