import React, { useEffect, useState } from 'react';
import crdt from '../../lib/afya-crdt-sdk';

const SERVER = process.env.REACT_APP_API_BASE || '';

export default function CRDTPatientEditor(){
  const [docObj, setDocObj] = useState(null);
  const [firstName, setFirstName] = useState('');
  useEffect(()=>{ async function init(){ const d = await crdt.initDoc('patients_demo'); setDocObj(d); if(d.doc && d.doc.patients){ const keys = Object.keys(d.doc.patients); if(keys.length) setFirstName(d.doc.patients[keys[0]].firstName || ''); } } init(); },[]);

  async function addPatient(){
    const updated = await crdt.changeDoc(docObj, doc=>{
      if(!doc.patients) doc.patients = {};
      const id = 'p_' + Date.now();
      doc.patients[id] = { firstName: 'New', lastName: '', createdAt: Date.now() };
    });
    setDocObj(updated);
  }

  async function sync(){
    await crdt.syncToServer(docObj, SERVER || window.location.origin);
    const serverDoc = await crdt.pullFromServer('patients_demo', SERVER || window.location.origin);
    if(serverDoc) alert('Pulled server doc with patients: ' + (serverDoc.patients? Object.keys(serverDoc.patients).length : 0));
  }

  return (<div><h2>CRDT Patient Editor (demo)</h2><button onClick={addPatient}>Add Patient</button><button onClick={sync}>Sync Now</button><div>First name sample: {firstName}</div></div>);
}
