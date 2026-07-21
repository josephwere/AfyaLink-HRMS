// frontend/src/pages/HospitalAdmin/Pharmacy.jsx
import React, { useEffect, useState } from 'react';
import PharmacyForm from '../../components/pharmacy/PharmacyForm';
import PharmacyTable from '../../components/pharmacy/PharmacyTable';
import { usePharmacyAdmin } from '../../hooks/usePharmacyAdmin';
import useOfflinePharmacySync from '../../hooks/useOfflinePharmacySync';

export default function Pharmacy() {
  const [editing, setEditing] = useState(null);
  const [openForm, setOpenForm] = useState(false);
  const [q, setQ] = useState('');
  const [page] = useState(1);

  const { data, loading, refresh, createItem, updateItem, deleteItem, addStock, dispenseStock } = usePharmacyAdmin({ q, page, limit: 25 });
  const syncPending = useOfflinePharmacySync();
  const items = data?.items || [];
  const total = data?.total || 0;

  useEffect(() => {
    refresh().catch((error) => {
      console.error('pharmacy refresh error', error);
    });
  }, [q, page, refresh]);

  useEffect(() => {
    const onOnline = () => {
      syncPending({ onSync: () => refresh().catch(console.error), onError: console.error });
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [refresh, syncPending]);

  const onCreate = async (payload) => {
    try {
      await createItem(payload);
      setOpenForm(false);
      refresh();
    } catch (e) {
      console.error('create offline', e);
      await idbPharmacy.queueCreate(payload);
      setOpenForm(false);
      refresh();
    }
  };

  const onUpdate = async (id, payload) => {
    try {
      await updateItem(id, payload);
      setEditing(null);
      refresh();
    } catch (e) {
      console.error('update offline', e);
      await idbPharmacy.queueUpdate(id, payload);
      setEditing(null);
      refresh();
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
          <button type="button" className="btn btn-primary" onClick={()=>{setOpenForm(true); setEditing(null);}}>
            Add Item
          </button>
        </div>
      </div>

      <PharmacyTable
        items={items}
        loading={loading}
        onEdit={(it)=>{ setEditing(it); setOpenForm(true); }}
        onDelete={async (id)=>{ await deleteItem(id); refresh(); }}
        onAddStock={async (id, payload)=>{ await addStock(id, payload); refresh(); }}
        onDispense={async (id, payload)=>{ await dispenseStock(id, payload); refresh(); }}
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
