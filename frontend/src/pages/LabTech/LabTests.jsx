import React, {useEffect, useState} from 'react';
import { apiFetch } from '../../utils/apiFetch';
export default function LabTests(){
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({patient:'', testType:''});
  useEffect(() => {
    loadLabTests();
  }, []);
  const loadLabTests = async () => {
    try {
      const data = await apiFetch('/api/labs');
      setItems(Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []);
    } catch {
      setItems([]);
    }
  };
  const create = async ()=> {
    if(!form.patient||!form.testType) return alert('patient and test required');
    try {
      await apiFetch('/api/labs', { method: 'POST', body: form });
      setForm({patient:'', testType:''});
      await loadLabTests();
    } catch (e) {
      alert(e?.message || "Failed to create lab test");
    }
  };
  const submitCreate = async (e) => {
    e.preventDefault();
    await create();
  };
  const upload = async (id)=> {
    try {
      const result = { values: { Hb: 10 + Math.round(Math.random()*5), WBC: 5 + Math.round(Math.random()*8) } };
      await apiFetch('/api/labs/'+id+'/result', { method: 'POST', body: { result, status: 'Completed' } });
      await loadLabTests();
    } catch (e) {
      alert(e?.message || "Failed to upload result");
    }
  };
  const remove = async (id)=> {
    try {
      await apiFetch('/api/labs/'+id, { method: 'DELETE' });
      await loadLabTests();
    } catch (e) {
      alert(e?.message || "Failed to delete lab test");
    }
  };
  return (<div className="dashboard">
    <h3>Lab Tests</h3>
    <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 12 }}>
      <div>
        <form className="card form" onSubmit={submitCreate}>
          <input placeholder="Patient ID" value={form.patient} onChange={e=>setForm({...form, patient:e.target.value})} />
          <input placeholder="Test type" value={form.testType} onChange={e=>setForm({...form, testType:e.target.value})} />
          <div>
            <button className="btn-primary" type="submit">Order</button>
          </div>
        </form>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table><thead><tr><th>Patient</th><th>Test</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{items.map(it=> <tr key={it._id}><td>{[it.patient?.firstName, it.patient?.lastName].filter(Boolean).join(' ') || it.patient}</td><td>{it.testType || it.testName}</td><td>{it.status}</td>
          <td><button type="button" className="btn-secondary" onClick={()=>upload(it._id)}>Upload Result</button><button type="button" className="btn-secondary" onClick={()=>remove(it._id)}>Delete</button></td></tr>)}</tbody></table>
        </div>
      </div>
    </div>
  </div>);
}
