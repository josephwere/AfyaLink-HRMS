import React, {useEffect, useState} from 'react';
import localforage from 'localforage';

localforage.config({ name: 'AfyaLinkOffline' });

export default function OfflineSync(){
  const [items,setItems]=useState([]);
  useEffect(()=>{ load(); window.addEventListener('online', syncAll); },[]);

  async function load(){ const keys = await localforage.keys(); const arr=[]; for(const k of keys){ const v = await localforage.getItem(k); arr.push({ key:k, val:v }); } setItems(arr); }
  async function addSample(){ const id = 'item_'+Date.now(); await localforage.setItem(id, { connectorId: 'connector-id', payload: 'HL7|...' }); load(); }

  async function syncAll(){
    const keys = await localforage.keys();
    const items = []; for(const k of keys){ items.push(await localforage.getItem(k)); }
    if(items.length===0) return alert('nothing to sync');
    // push in batch to backend
    const r = await fetch(`import.meta.env.VITE_API_URL}'}/api/offline/upload', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ items }) , credentials:'include' });
    if(r.ok){ for(const k of keys) await localforage.removeItem(k); alert('synced'); load(); } else { alert('sync failed'); }
  }

  return (<div><h2>Offline Sync</h2><button onClick={addSample}>Add Sample Local Item</button><button onClick={syncAll}>Sync Now</button><button onClick={load}>Refresh</button><div>{items.map(it=>(<div key={it.key}><pre>{JSON.stringify(it.val)}</pre></div>))}</div></div>);
}
