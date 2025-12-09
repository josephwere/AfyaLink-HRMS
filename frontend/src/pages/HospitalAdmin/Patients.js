import React, {useEffect, useState} from 'react';
import API from '../../utils/api';
export default function Patients(){
  const [patients, setPatients] = useState([]);
  const [form, setForm] = useState({firstName:'', lastName:'', nationalId:'', dob:''});
  useEffect(()=>{ fetch(); },[]);
  const fetch = ()=> API.get('/patients').then(r=>setPatients(r.data)).catch(()=>{});
  const create = async ()=> {
    await API.post('/patients', {...form, hospital: 'placeholder'}).then(()=>{ fetch(); setForm({firstName:'', lastName:'', nationalId:'', dob:''}); });
  };
  return (
    <div>
      <h3>Patients</h3>
      <div style={{display:'flex',gap:12}}>
        <div style={{flex:1}}>
          <input placeholder="First" value={form.firstName} onChange={e=>setForm({...form, firstName:e.target.value})} />
          <input placeholder="Last" value={form.lastName} onChange={e=>setForm({...form, lastName:e.target.value})} />
          <input placeholder="National ID" value={form.nationalId} onChange={e=>setForm({...form, nationalId:e.target.value})} />
          <input placeholder="DOB" type="date" value={form.dob} onChange={e=>setForm({...form, dob:e.target.value})} />
          <button onClick={create}>Create</button>
        </div>
        <div style={{flex:2}}>
          <table><thead><tr><th>Name</th><th>ID</th></tr></thead>
            <tbody>{patients.map(p=> <tr key={p._id}><td>{p.firstName} {p.lastName}</td><td>{p.nationalId}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
