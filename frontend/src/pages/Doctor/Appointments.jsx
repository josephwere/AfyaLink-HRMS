import React, {useEffect, useState} from 'react';
import { useDoctorAppointments } from '../../hooks/useDoctorAppointments';
export default function Appointments(){
  const { items, loadAppointments, create, remove, update } = useDoctorAppointments();
  const [form, setForm] = useState({patient:'', doctor:'', scheduledAt:'', durationMins:30});
  const [consultationModeDrafts, setConsultationModeDrafts] = useState({});
  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);
  const submitCreate = async (e) => {
    e.preventDefault();
    if(!form.patient||!form.scheduledAt){ alert('patient and date required'); return;}
    try {
      await create({
        ...form,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Nairobi',
      });
      setForm({patient:'', doctor:'', scheduledAt:'', durationMins:30});
    } catch (e) {
      alert(e?.message || "Failed to create appointment");
    }
  };
  return (<div className="dashboard">
    <h3>Appointments</h3>
    <div className="grid info-grid" style={{ gap: 12 }}>
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
          <table><thead><tr><th>Patient</th><th>Doctor</th><th>When</th><th>Mode</th><th>Actions</th></tr></thead>
          <tbody>{items.map(it=> <tr key={it._id}><td>{it.patient?.firstName || it.patient}</td><td>{it.doctor?.name || it.doctor}</td><td>{new Date(it.scheduledAt).toLocaleString()}</td><td>
            <select value={consultationModeDrafts[it._id] || String(it.consultationMode || 'IN_PERSON')} onChange={(e)=>setConsultationModeDrafts((prev)=>({...prev,[it._id]: e.target.value}))}>
              <option value="IN_PERSON">IN_PERSON</option>
              <option value="VOICE">VOICE</option>
              <option value="VIDEO">VIDEO</option>
            </select>
          </td>
          <td><button type="button" className="btn-secondary" onClick={()=>update(it._id)}>Complete</button><button type="button" className="btn-secondary" onClick={()=>remove(it._id)}>Delete</button><button type="button" className="btn-secondary" onClick={()=>update(it._id, { consultationMode: consultationModeDrafts[it._id] || String(it.consultationMode || 'IN_PERSON') })}>Approve mode change</button></td></tr>)}</tbody></table>
        </div>
      </div>
    </div>
  </div>);
}
