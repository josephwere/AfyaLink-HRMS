import React, { useState } from 'react';
import { useLabTests } from '../../hooks/useLabTests';
export default function LabTests(){
  const [form, setForm] = useState({patient:'', testType:''});
  const { items, loadLabTests, create, upload, remove } = useLabTests();
  const submitCreate = async (e) => {
    e.preventDefault();
    await create(form);
  };
  return (<div className="dashboard">
    <h3>Lab Tests</h3>
	    <div className="grid info-grid" style={{ gap: 12 }}>
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
