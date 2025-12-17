// AfyaLink Offline SDK (browser / Node capable)
// Depends on localforage for browser, and provides a simple protocol to store events and sync them.
// Edge mesh placeholders included as comments for future mesh integration.
import localforage from 'localforage';

localforage.config({ name: 'AfyaLinkOfflineSDK' });

export async function saveEvent(connectorId, payload){
  const id = 'evt_'+Date.now()+'_'+Math.random().toString(36).slice(2,8);
  await localforage.setItem(id, { connectorId, payload, ts: Date.now() });
  return id;
}

export async function listEvents(){
  const keys = await localforage.keys();
  const out = [];
  for(const k of keys){ out.push({ key:k, val: await localforage.getItem(k) }); }
  return out;
}

export async function clearEvent(key){ await localforage.removeItem(key); }

export async function syncAll(serverUrl, authFetchOptions = {}){
  const events = await listEvents();
  if(events.length===0) return { ok:true, sent:0 };
  const items = events.map(e=>({ connectorId: e.val.connectorId, payload: e.val.payload, sig: '' }));
  const r = await fetch(serverUrl + '/api/offline/upload', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ items }), credentials:'include', ...authFetchOptions });
  if(r.ok){
    for(const e of events) await clearEvent(e.key);
    return { ok:true, sent: events.length };
  }
  return { ok:false, status: r.status };
}

// Edge Mesh placeholder: implement mesh sync via local peer connectivity (WebRTC / WebTransport)
// export async function meshSync(peers){ /* TODO: implement later */ }
