import Automerge from 'automerge';
import localforage from 'localforage';
localforage.config({ name: 'AfyaLinkCRDT' });

// Simple CRDT client wrapper
export async function initDoc(docId){
  const stored = await localforage.getItem('doc:' + docId);
  let doc;
  if(stored && stored.bin){
    try{ doc = Automerge.load(Uint8Array.from(atob(stored.bin), c=>c.charCodeAt(0))); }catch(e){ console.error('load local doc fail', e); doc = Automerge.init(); }
  } else {
    doc = Automerge.init();
  }
  return { doc, docId };
}

export async function saveLocal(docId, doc){
  const bin = Automerge.save(doc); // string -> binary-like
  const b64 = btoa(String.fromCharCode(...new Uint8Array(bin))); // may be large
  await localforage.setItem('doc:' + docId, { bin: b64, ts: Date.now() });
  return true;
}

// Create change locally with changeFn and persist
export async function changeDoc(docObj, changeFn){
  const newDoc = Automerge.change(docObj.doc, changeFn);
  await saveLocal(docObj.docId, newDoc);
  docObj.doc = newDoc;
  return docObj;
}

// Get local changes and send to server
export async function syncToServer(docObj, serverUrl){
  // compute changes since last sync: use Automerge.getAllChanges
  const changes = Automerge.getAllChanges(docObj.doc);
  const b64changes = changes.map(c=> btoa(String.fromCharCode(...new Uint8Array(c))));
  const res = await fetch(serverUrl + '/api/crdt/' + docObj.docId + '/changes', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ changes: b64changes }), credentials:'include' });
  if(res.ok) return true;
  return false;
}

// Pull full doc from server and merge
export async function pullFromServer(docId, serverUrl){
  const r = await fetch(serverUrl + '/api/crdt/' + docId, { credentials:'include' });
  if(!r.ok) throw new Error('pull failed');
  const js = await r.json();
  if(!js.bin) return null;
  const bin = Uint8Array.from(atob(js.bin), c=>c.charCodeAt(0));
  const serverDoc = Automerge.load(bin);
  // save locally
  await saveLocal(docId, serverDoc);
  return serverDoc;
}

export default { initDoc, changeDoc, saveLocal, syncToServer, pullFromServer };
