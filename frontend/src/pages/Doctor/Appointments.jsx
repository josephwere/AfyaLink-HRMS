import React, {useEffect, useState} from 'react';
import { apiFetch } from '../../utils/apiFetch';
export default function Appointments(){
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({patient:'', doctor:'', scheduledAt:'', durationMins:30});
  useEffect(() => {
    loadAppointments();
  }, []);
  const loadAppointments = async () => {
    try {
      const data = await apiFetch('/api/appointments');
      setItems(Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []);
    } catch {
      setItems([]);
    }
  };
  const create = async ()=> {
    if(!form.patient||!form.scheduledAt){ alert('patient and date required'); return;}
    try {
      await apiFetch('/api/appointments', { method: 'POST', body: form });
      setForm({patient:'', doctor:'', scheduledAt:'', durationMins:30});
      await loadAppointments();
    } catch (e) {
      alert(e?.message || "Failed to create appointment");
    }
  };
  const remove = async (id)=> {
    try {
      await apiFetch('/api/appointments/'+id, { method: 'DELETE' });
      await loadAppointments();
    } catch (e) {
      alert(e?.message || "Failed to delete appointment");
    }
  };
  const update = async (id)=> {
    try {
      await apiFetch('/api/appointments/'+id, { method: 'PATCH', body: { status: 'Completed' } });
      await loadAppointments();
    } catch (e) {
      alert(e?.message || "Failed to update appointment");
    }
  };
  const submitCreate = async (e) => {
    e.preventDefault();
    await create();
  };
  return (<div className="dashboard">
    <h3>Appointments</h3>
    <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 12 }}>
      <div>
        <form className="card form" onSubmit={submitCreate}>
          <input placeholder="Patient ID" value={form.patient} onChange={e=>setForm({...form, patient:e.target.value})} />
          <input placeholder="Doctor ID" value={form.doctor} onChange={e=>setForm({...form, doctor:e.target.value})} />
          <input type="datetime-local" value={form.scheduledAt} onChange={e=>setForm({...form, scheduledAt:e.target.value})} />
          <input type="number" value={form.durationMins} onChange={e=>setForm({...form, durationMins:parseInt(e.target.value||30)})} />
          <div>
            <button className="btn-primary" type="submit">Create</button>
          </div>
        </form>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table><thead><tr><th>Patient</th><th>Doctor</th><th>When</th><th>Actions</th></tr></thead>
          <tbody>{items.map(it=> <tr key={it._id}><td>{it.patient?.firstName || it.patient}</td><td>{it.doctor?.name || it.doctor}</td><td>{new Date(it.scheduledAt).toLocaleString()}</td>
          <td><button type="button" className="btn-secondary" onClick={()=>update(it._id)}>Complete</button><button type="button" className="btn-secondary" onClick={()=>remove(it._id)}>Delete</button></td></tr>)}</tbody></table>
        </div>
      </div>
    </div>
  </div>);
}
