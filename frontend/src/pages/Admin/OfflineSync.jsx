import React, {useEffect, useState} from 'react';
import localforage from 'localforage';
import { fetchApi } from "../../lib/api/client";

localforage.config({ name: 'AfyaLinkOffline' });

export default function OfflineSync(){
  const [items,setItems]=useState([]);
  const [msg, setMsg] = useState("");
  useEffect(()=>{
    load();
    window.addEventListener('online', syncAll);
    return () => window.removeEventListener('online', syncAll);
  },[]);

  async function load(){
    try {
      const keys = await localforage.keys();
      const arr=[];
      for(const k of keys){
        const v = await localforage.getItem(k);
        arr.push({ key:k, val:v });
      }
      setItems(arr);
    } catch (e) {
      setMsg(e?.message || "Failed to load offline queue");
      setItems([]);
    }
  }
  async function addSample(){
    try {
      const id = 'item_'+Date.now();
      await localforage.setItem(id, { connectorId: 'connector-id', payload: 'HL7|...' });
      setMsg("Sample item added");
      load();
    } catch (e) {
      setMsg(e?.message || "Failed to add sample item");
    }
  }

  async function syncAll(){
    try {
      const keys = await localforage.keys();
      const rows = [];
      for(const k of keys){ rows.push(await localforage.getItem(k)); }
      if(rows.length===0) {
        setMsg('Nothing to sync');
        return;
      }
      await fetchApi("/api/offline/upload", {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: { items: rows },
      });
      for(const k of keys) await localforage.removeItem(k);
      setMsg('Synced successfully');
      load();
    } catch (e) {
      setMsg(e?.message || "Sync failed");
    }
  }

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
