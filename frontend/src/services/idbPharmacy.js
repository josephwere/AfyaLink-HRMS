// frontend/src/services/idbPharmacy.js
// lightweight idb helper for the pharmacy module
const DB_NAME = 'afyalink_pharmacy_v1';
const STORE_ITEMS = 'items';
const STORE_QUEUE = 'queue';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_ITEMS)) db.createObjectStore(STORE_ITEMS, { keyPath: '_id' });
      if (!db.objectStoreNames.contains(STORE_QUEUE)) db.createObjectStore(STORE_QUEUE, { autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveItems(items = []) {
  const db = await openDB();
  const tx = db.transaction([STORE_ITEMS], 'readwrite');
  const store = tx.objectStore(STORE_ITEMS);
  store.clear();
  items.forEach(i => store.put(i));
  return tx.complete;
}

async function getAllItems() {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction([STORE_ITEMS], 'readonly');
    const store = tx.objectStore(STORE_ITEMS);
    const req = store.getAll();
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

async function queueCreate(payload) {
  const db = await openDB();
  const tx = db.transaction([STORE_QUEUE], 'readwrite');
  const store = tx.objectStore(STORE_QUEUE);
  store.add({ op: 'create', payload, createdAt: Date.now() });
  return tx.complete;
}

async function queueUpdate(id, payload) {
  const db = await openDB();
  const tx = db.transaction([STORE_QUEUE], 'readwrite');
  const store = tx.objectStore(STORE_QUEUE);
  store.add({ op: 'update', id, payload, createdAt: Date.now() });
  return tx.complete;
}

async function getQueue() {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction([STORE_QUEUE], 'readonly');
    const store = tx.objectStore(STORE_QUEUE);
    const req = store.getAll();
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

async function clearQueue() {
  const db = await openDB();
  const tx = db.transaction([STORE_QUEUE], 'readwrite');
  tx.objectStore(STORE_QUEUE).clear();
  return tx.complete;
}

// sync pending queue to server (very simple)
import api from './pharmacyApi';
async function syncPending() {
  const q = await getQueue();
  if (!q || q.length === 0) return;
  for (const entry of q) {
    try {
      if (entry.op === 'create') {
        await api.createItem(entry.payload);
      } else if (entry.op === 'update') {
        await api.updateItem(entry.id, entry.payload);
      }
      // ignore errors for now - we continue
    } catch (e) {
      console.warn('sync error', e);
    }
  }
  await clearQueue();
  // after sync, fetch real items
  const list = await api.listItems();
  await saveItems(list.items || []);
}
export default { saveItems, getAllItems, queueCreate, queueUpdate, getQueue, clearQueue, syncPending };
