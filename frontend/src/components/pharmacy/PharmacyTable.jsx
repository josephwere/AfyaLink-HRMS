// frontend/src/components/pharmacy/PharmacyTable.jsx
import React from 'react';

export default function PharmacyTable({ items = [], loading, onEdit, onDelete, onAddStock, onDispense }) {
  return (
    <div className="bg-white rounded shadow overflow-hidden">
      <table className="min-w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-3 text-left">Name</th>
            <th className="p-3 text-left">SKU</th>
            <th className="p-3 text-left">Stock</th>
            <th className="p-3 text-left">Min</th>
            <th className="p-3 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan="5" className="p-4">Loading…</td></tr>
          ) : items.length === 0 ? (
            <tr><td colSpan="5" className="p-4">No items</td></tr>
          ) : items.map(it => (
            <tr key={it._id} className={(it.totalQuantity <= it.minStock ? 'bg-yellow-50' : '')}>
              <td className="p-3">{it.name}</td>
              <td className="p-3">{it.sku || '—'}</td>
              <td className="p-3">{it.totalQuantity}</td>
              <td className="p-3">{it.minStock}</td>
              <td className="p-3">
                <div className="flex gap-2">
                  <button className="btn btn-sm" onClick={()=>onEdit(it)}>Edit</button>
                  <button className="btn btn-sm btn-danger" onClick={()=>onDelete(it._id)}>Delete</button>
                  <button className="btn btn-sm" onClick={()=> {
                    const q = prompt('Add stock (json): {"batchNumber":"B1","expiryDate":"2026-12-01","quantity":10}');
                    if (!q) return;
                    try { const payload = JSON.parse(q); onAddStock(it._id, payload); } catch (e){ alert('invalid json'); }
                  }}>Add Stock</button>
                  <button className="btn btn-sm" onClick={()=> {
                    const qty = prompt('Quantity to dispense');
                    if (!qty) return;
                    onDispense(it._id, { quantity: Number(qty) });
                  }}>Dispense</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
