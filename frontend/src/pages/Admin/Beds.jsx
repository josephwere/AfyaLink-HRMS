import React, {useEffect, useState} from 'react';
import { apiFetch } from "../../utils/apiFetch";

export default function Beds(){
  const [beds,setBeds]=useState([]);
  const [msg, setMsg] = useState("");
  useEffect(()=>{ load(); },[]);
  async function load(){
    try {
      const js = await apiFetch('/api/beds');
      const rows = Array.isArray(js) ? js : Array.isArray(js?.data) ? js.data : [];
      setBeds(rows);
    } catch (e) {
      setMsg(e?.message || "Failed to load beds");
      setBeds([]);
    }
  }
  async function toggle(b){
    try {
      await apiFetch('/api/beds/'+b._id, {
        method:'PUT',
        body:{ occupied: !b.occupied, patient: b.occupied? null : 'patient-id' }
      });
      setMsg(`Bed ${b.number} updated`);
      load();
    } catch (e) {
      setMsg(e?.message || "Failed to update bed");
    }
  }
  return (
    <div className="dashboard">
      <h2>Beds</h2>
      {msg ? <p className="muted">{msg}</p> : null}
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: 12 }}>
        {beds.map(b => (
          <div key={b._id} className="card">
            <div>{b.ward} - {b.number}</div>
            <div>Occupied: {b.occupied? 'Yes':'No'}</div>
            <button type="button" className="btn-secondary" onClick={()=>toggle(b)}>
              {b.occupied? 'Free' : 'Assign'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
