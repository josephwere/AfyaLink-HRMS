import React, { useEffect, useState } from 'react';
import crdt from '../../lib/afya-crdt-sdk';
import { resolveApiBase } from "../../utils/networkBase";

export default function CRDTPatientEditor(){
  const [docObj, setDocObj] = useState(null);
  const [firstName, setFirstName] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(()=>{
    async function init(){
      try {
        const d = await crdt.initDoc('patients_demo');
        setDocObj(d);
        if(d.doc && d.doc.patients){
          const keys = Object.keys(d.doc.patients);
          if(keys.length) setFirstName(d.doc.patients[keys[0]].firstName || '');
        }
      } catch (e) {
        setMsg(e?.message || "Failed to initialize CRDT doc");
      }
    }
    init();
  },[]);

  async function addPatient(){
    try {
      const updated = await crdt.changeDoc(docObj, doc=>{
        if(!doc.patients) doc.patients = {};
        const id = 'p_' + Date.now();
        doc.patients[id] = { firstName: 'New', lastName: '', createdAt: Date.now() };
      });
      setDocObj(updated);
      setMsg("Patient added to local CRDT document");
    } catch (e) {
      setMsg(e?.message || "Failed to add patient");
    }
  }

  async function sync(){
    try {
      const serverBase = resolveApiBase(import.meta.env.VITE_API_URL || window.__ENV__?.API_URL || "");
      await crdt.syncToServer(docObj, serverBase);
      const serverDoc = await crdt.pullFromServer('patients_demo', serverBase);
      if(serverDoc) setMsg('Pulled server doc with patients: ' + (serverDoc.patients? Object.keys(serverDoc.patients).length : 0));
    } catch (e) {
      setMsg(e?.message || "Sync failed");
    }
  }

  return (
    <div className="dashboard">
      <h2>CRDT Patient Editor (demo)</h2>
      <div className="welcome-actions">
        <button type="button" className="btn-secondary" onClick={addPatient}>Add Patient</button>
        <button type="button" className="btn-primary" onClick={sync}>Sync Now</button>
      </div>
      {msg ? <p className="muted">{msg}</p> : null}
      <div>First name sample: {firstName}</div>
    </div>
  );
}
