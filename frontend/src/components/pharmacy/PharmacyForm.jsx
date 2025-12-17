// frontend/src/components/pharmacy/PharmacyForm.jsx
import React, { useEffect, useState } from 'react';

export default function PharmacyForm({ item, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: '',
    sku: '',
    description: '',
    unit: 'pcs',
    minStock: 0
  });

  useEffect(()=> {
    if (item) setForm({
      name: item.name || '',
      sku: item.sku || '',
      description: item.description || '',
      unit: item.unit || 'pcs',
      minStock: item.minStock || 0
    });
  }, [item]);

  function change(k, v){ setForm(prev => ({ ...prev, [k]: v })); }
  return (
    <div className="fixed inset-0 flex items-start justify-center p-6 z-50">
      <div className="bg-white rounded shadow-lg w-full max-w-2xl p-6">
        <h3 className="text-lg font-semibold mb-4">{item ? 'Edit item' : 'Add item'}</h3>
        <div className="grid grid-cols-2 gap-4">
          <input value={form.name} onChange={e=>change('name', e.target.value)} placeholder="Name" className="border p-2 rounded" />
          <input value={form.sku} onChange={e=>change('sku', e.target.value)} placeholder="SKU" className="border p-2 rounded" />
          <input value={form.unit} onChange={e=>change('unit', e.target.value)} placeholder="Unit" className="border p-2 rounded" />
          <input type="number" value={form.minStock} onChange={e=>change('minStock', e.target.value)} placeholder="Min stock" className="border p-2 rounded" />
          <textarea value={form.description} onChange={e=>change('description', e.target.value)} placeholder="Description" className="col-span-2 border p-2 rounded" />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={()=>onSave(form)}>Save</button>
        </div>
      </div>
    </div>
  );
}
