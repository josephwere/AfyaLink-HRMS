import React, {useEffect, useState} from 'react';
import API from '../../utils/api';
export default function LabTests(){
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({patient:'', testType:''});
  useEffect(()=> fetch(),[]);
  const fetch = ()=> API.get('/labs').then(r=>setItems(r.data)).catch(()=>{});
  const create = async ()=> { if(!form.patient||!form.testType) return alert('patient and test required'); await API.post('/labs', form); setForm({patient:'', testType:''}); fetch(); };
  const upload = async (id)=> { const result = { values: { Hb: 10 + Math.round(Math.random()*5), WBC: 5 + Math.round(Math.random()*8) } }; await API.post('/labs/'+id+'/result', { result, status: 'Completed' }); fetch(); };
  const remove = async (id)=> { await API.delete('/labs/'+id); fetch(); };
  return (<div>
    <h3>Lab Tests</h3>
    <div style={{display:'flex',gap:12}}>
      <div style={{flex:1}}>
        <input placeholder="Patient ID" value={form.patient} onChange={e=>setForm({...form, patient:e.target.value})} />
        <input placeholder="Test type" value={form.testType} onChange={e=>setForm({...form, testType:e.target.value})} />
        <button onClick={create}>Order</button>
      </div>
      <div style={{flex:2}}>
        <table><thead><tr><th>Patient</th><th>Test</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>{items.map(it=> <tr key={it._id}><td>{it.patient?.firstName || it.patient}</td><td>{it.testType}</td><td>{it.status}</td>
        <td><button onClick={()=>upload(it._id)}>Upload Result</button><button onClick={()=>remove(it._id)}>Delete</button></td></tr>)}</tbody></table>
      </div>
    </div>
  </div>);
}
