import React, {useEffect, useState} from 'react';
import { apiFetch } from '../../utils/apiFetch';
export default function Financials(){
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({patient:'', items:[{description:'Consultation', amount:50}]});
  useEffect(() => {
    loadFinancials();
  }, [page]);
  const loadFinancials = async () => {
    try {
      const data = await apiFetch('/api/financials?page='+page+'&limit=25');
      const payload = data && typeof data === "object" ? data : {};
      if (Array.isArray(data)) {
        setItems(data);
        setTotal(data.length);
      } else {
        setItems(Array.isArray(payload.items) ? payload.items : []);
        setTotal(Number(payload.total || 0));
      }
    } catch {
      setItems([]);
      setTotal(0);
    }
  };
  const create = async ()=> {
    try {
      await apiFetch('/api/financials', { method: 'POST', body: form });
      setForm({patient:'', items:[{description:'Consultation', amount:50}]});
      await loadFinancials();
    } catch (e) {
      alert(e?.message || "Failed to create invoice");
    }
  };
  const submitCreate = async (e) => {
    e.preventDefault();
    await create();
  };
  const pay = async (id)=> {
    const amount = prompt('Amount to pay', '0');
    if(!amount) return;
    try {
      await apiFetch('/api/financials/'+id+'/pay', {
        method: 'POST',
        body: { amount: Number(amount), method: 'Card', reference: 'WEB' },
      });
      await loadFinancials();
    } catch (e) {
      alert(e?.message || "Failed to record payment");
    }
  };
  const claim = async (id)=> {
    const provider = prompt('Provider', 'NHIF');
    try {
      await apiFetch('/api/financials/'+id+'/claim', { method: 'POST', body: { provider } });
      await loadFinancials();
    } catch (e) {
      alert(e?.message || "Failed to submit claim");
    }
  };
  return (
    <div className="dashboard">
      <h3>Financials</h3>
      <div className="grid" style={{ gridTemplateColumns: "minmax(280px, 360px) 1fr", gap: 12 }}>
        <div>
          <form className="card form" onSubmit={submitCreate}>
            <input
              placeholder="Patient ID"
              value={form.patient}
              onChange={e=>setForm({...form, patient:e.target.value})}
            />
            <div>
              <button className="btn-primary" type="submit">Create Invoice</button>
            </div>
          </form>
        </div>
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Patient</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(it=> (
                  <tr key={it._id}>
                    <td>{it.invoiceNumber}</td>
                    <td>{it.patient?.firstName || it.patient}</td>
                    <td>{it.total}</td>
                    <td>{it.status}</td>
                    <td>
                      <button type="button" className="btn-secondary" onClick={()=>pay(it._id)}>Pay</button>
                      <button type="button" className="btn-secondary" onClick={()=>claim(it._id)}>Claim</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="welcome-actions mt-12">
            <button type="button" className="btn-secondary" onClick={()=>setPage(p=>Math.max(1,p-1))}>Prev</button>
            <span>Page {page}</span>
            <button type="button" className="btn-secondary" onClick={()=>setPage(p=>p+1)}>Next</button>
            <span>Total {total}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
