import React, {useEffect, useState} from 'react';
import { apiFetch } from '../../services/api';

export default function Beds(){
  const [beds,setBeds]=useState([]);
  useEffect(()=>{ load(); },[]);
  async function load(){ const r = await apiFetch('/api/beds'); const js = await r.json(); setBeds(js.data||[]); }
  async function toggle(b){ await apiFetch('/api/beds/'+b._id, { method:'PUT', body:{ occupied: !b.occupied, patient: b.occupied? null : 'patient-id' } }); load(); }
  return (<div><h2>Beds</h2>{beds.map(b=>(<div key={b._id} style={{padding:8,margin:8,background:'#fff1'}}><div>{b.ward} - {b.number}</div><div>Occupied: {b.occupied? 'Yes':'No'}</div><button onClick={()=>toggle(b)}>{b.occupied? 'Free' : 'Assign'}</button></div>))}</div>);
}
