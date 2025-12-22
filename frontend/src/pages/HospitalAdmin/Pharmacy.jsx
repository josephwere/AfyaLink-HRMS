// frontend/src/pages/HospitalAdmin/Pharmacy.jsx
import React, { useEffect, useState } from 'react';
import {
  listItems,
  createItem,
  updateItem,
  deleteItem,
  addStock,
  dispenseStock
} from '../../services/pharmacyApi';
import PharmacyForm from '../../components/pharmacy/PharmacyForm';
import PharmacyTable from '../../components/pharmacy/PharmacyTable';
import idbPharmacy from '../../services/idbPharmacy';

export default function Pharmacy() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const [openForm, setOpenForm] = useState(false);
  const [total, setTotal] = useState(0);

  async function fetchItems() {
    setLoading(true);
    try {
      const res = await listItems({ q, page, limit: 25 });
      setItems(res.items || []);
      setTotal(res.total || 0);
      // cache offline
      idbPharmacy.saveItems(res.items || []);
    } catch (err) {
      // fallback to IDB when offline
      console.error('list error', err);
      const cached = await idbPharmacy.getAllItems();
      setItems(cached || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchItems();
    // attempt sync loop when back online
    window.addEventListener('online', () => {
      idbPharmacy.syncPending().then(fetchItems).catch(console.error);
    });
  }, [page, q]);

  const onCreate = async (payload) => {
    try {
      const it = await createItem(payload);
      setOpenForm(false);
      fetchItems();
    } catch (e) {
      console.error('create offline', e);
      await idbPharmacy.queueCreate(payload);
      setOpenForm(false);
      fetchItems();
    }
  };

  const onUpdate = async (id, payload) => {
    try {
      await updateItem(id, payload);
      setEditing(null);
      fetchItems();
    } catch (e) {
      console.error('update offline', e);
      await idbPharmacy.queueUpdate(id, payload);
      setEditing(null);
      fetchItems();
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Pharmacy</h1>
        <div className="flex gap-2">
          <input
            type="search"
            placeholder="Search medicines..."
            value={q}
            onChange={(e)=>setQ(e.target.value)}
            className="border px-3 py-2 rounded"
          />
          <button className="btn btn-primary" onClick={()=>{setOpenForm(true); setEditing(null);}}>
            Add Item
          </button>
        </div>
      </div>

      <PharmacyTable
        items={items}
        loading={loading}
        onEdit={(it)=>{ setEditing(it); setOpenForm(true); }}
        onDelete={async (id)=>{ await deleteItem(id); fetchItems(); }}
        onAddStock={async (id, payload)=>{ await addStock(id, payload); fetchItems(); }}
        onDispense={async (id, payload)=>{ await dispenseStock(id, payload); fetchItems(); }}
      />

      {openForm && (
        <PharmacyForm
          item={editing}
          onCancel={()=>setOpenForm(false)}
          onSave={async (payload)=> {
            if (editing) await onUpdate(editing._id, payload);
            else await onCreate(payload);
            fetchItems();
          }}
        />
      )}
      <div className="mt-4 text-sm text-muted">Total items: {total}</div>
    </div>
  );
}
