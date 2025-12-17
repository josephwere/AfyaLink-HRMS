// Minimal CRDT-like SDK shim that uses localStorage.
// Provides an async API similar to a network-backed SDK so existing imports work.

const KEY = "afya_crdt_patients_v1";

function load(){ try{ return JSON.parse(localStorage.getItem(KEY)||"{}"); }catch(e){ return {}; } }
function save(obj){ localStorage.setItem(KEY, JSON.stringify(obj)); }

export async function createPatient(patient){
  const id = patient.id || (Date.now().toString(36) + Math.random().toString(36).slice(2,8));
  const store = load();
  store[id] = {...patient, id, createdAt: new Date().toISOString()};
  save(store);
  return store[id];
}

export async function getPatient(id){
  const store = load();
  return store[id] || null;
}

export async function listPatients(){
  const store = load();
  return Object.values(store).sort((a,b)=> (b.createdAt||"") - (a.createdAt||""));
}

export async function updatePatient(id, patch){
  const store = load();
  if(!store[id]) throw new Error("not found");
  store[id] = {...store[id], ...patch, updatedAt: new Date().toISOString()};
  save(store);
  return store[id];
}

export async function deletePatient(id){
  const store = load();
  delete store[id];
  save(store);
  return true;
}

export default { createPatient, getPatient, listPatients, updatePatient, deletePatient };
