import crdtStore from './crdtStore.js';
import * as Automerge from "@automerge/automerge";



// Helper document keys
export const patientDocId = (hospitalId) => `patients:${hospitalId}`;
export const visitsDocId = (hospitalId) => `visits:${hospitalId}`;
export const prescriptionsDocId = (hospitalId) => `prescriptions:${hospitalId}`;

// getPatients: returns full patient map from CRDT
export async function getPatients(hospitalId){
  const doc = await crdtStore.loadDoc(patientDocId(hospitalId));
  return doc.patients || {};
}

// addPatient: apply Automerge change and save
export async function addPatient(hospitalId, patientObj){
  let doc = await crdtStore.loadDoc(patientDocId(hospitalId));
  const newDoc = Automerge.change(doc, d => {
    if(!d.patients) d.patients = {};
    const id = 'p_'+Date.now()+'_'+Math.random().toString(36).slice(2,6);
    d.patients[id] = patientObj;
  });
  await crdtStore.saveDoc(patientDocId(hospitalId), newDoc);
  return true;
}

export default { getPatients, addPatient };
