import React, {useEffect, useState} from 'react';
import API from '../../utils/api';
export default function Appointments(){
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({patient:'', doctor:'', scheduledAt:'', durationMins:30});
  useEffect(()=> fetch(),[]);
  const fetch = ()=> API.get('/appointments').then(r=>setItems(r.data)).catch(()=>{});
  const create = async ()=> { if(!form.patient||!form.scheduledAt){ alert('patient and date required'); return;} await API.post('/appointments', form); setForm({patient:'', doctor:'', scheduledAt:'', durationMins:30}); fetch(); };
  const remove = async (id)=> { await API.delete('/appointments/'+id); fetch(); };
  const update = async (id)=> { await API.patch('/appointments/'+id, { status: 'Completed' }); fetch(); };
  return (<div>
    <h3>Appointments</h3>
    <div style={{display:'flex',gap:12}}>
      <div style={{flex:1}}>
        <input placeholder="Patient ID" value={form.patient} onChange={e=>setForm({...form, patient:e.target.value})} />
        <input placeholder="Doctor ID" value={form.doctor} onChange={e=>setForm({...form, doctor:e.target.value})} />
        <input type="datetime-local" value={form.scheduledAt} onChange={e=>setForm({...form, scheduledAt:e.target.value})} />
        <input type="number" value={form.durationMins} onChange={e=>setForm({...form, durationMins:parseInt(e.target.value||30)})} />
        <button onClick={create}>Create</button>
      </div>
      <div style={{flex:2}}>
        <table><thead><tr><th>Patient</th><th>Doctor</th><th>When</th><th>Actions</th></tr></thead>
        <tbody>{items.map(it=> <tr key={it._id}><td>{it.patient?.firstName || it.patient}</td><td>{it.doctor?.name || it.doctor}</td><td>{new Date(it.scheduledAt).toLocaleString()}</td>
        <td><button onClick={()=>update(it._id)}>Complete</button><button onClick={()=>remove(it._id)}>Delete</button></td></tr>)}</tbody></table>
      </div>
    </div>
  </div>);
}
