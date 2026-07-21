import React from 'react';
import { useOfflineSync } from "../../hooks/useOfflineSync";

export default function OfflineSync(){
  const { items, msg, addSample, syncAll, load } = useOfflineSync();

  return (
    <div className="dashboard">
      <h2>Offline Sync</h2>
      <div className="welcome-actions">
        <button type="button" className="btn-secondary" onClick={addSample}>Add Sample Local Item</button>
        <button type="button" className="btn-primary" onClick={syncAll}>Sync Now</button>
        <button type="button" className="btn-secondary" onClick={load}>Refresh</button>
      </div>
      {msg ? <p className="muted">{msg}</p> : null}
      <div className="card">
        {items.map(it => (
          <div key={it.key}>
            <pre>{JSON.stringify(it.val)}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}
