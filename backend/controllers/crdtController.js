import { createPatientCRDT, listPatientsCRDT } from '../models/crdtModels.js';

export async function createPatient(req,res){
  const data = req.body;
  const doc = await createPatientCRDT(data);
  res.json({ ok:true, docId: 'afya:patients' });
}

export async function listPatients(req,res){
  const pts = await listPatientsCRDT();
  res.json({ ok:true, patients: pts });
}
