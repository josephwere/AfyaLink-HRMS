/* CRDT models - wrappers around Automerge docs stored in CRDT store
   Each resource is represented as a key in a shared Automerge doc:
   docId: 'afya:patients' -> doc.patients = { <id>: { firstName, lastName, ... } }
*/

import * as Automerge from "@automerge/automerge";
import { loadDoc, saveDoc } from "../services/crdtStore.js";

// -----------------------------
// Load / Save Patients Document
// -----------------------------
export async function loadPatientsDoc() {
  return await loadDoc("afya:patients");
}

export async function savePatientsDoc(doc) {
  return await saveDoc("afya:patients", doc);
}

// -----------------------------
// Create Patient in CRDT
// -----------------------------
export async function createPatientCRDT(data) {
  let doc = await loadPatientsDoc();

  // Ensure CRDT shape exists
  if (!doc.patients) {
    doc = Automerge.change(doc, "init patients", (d) => {
      d.patients = {};
    });
  }

  const id = data.id || "p_" + Date.now();

  const newDoc = Automerge.change(doc, "create patient", (d) => {
    d.patients[id] = data;
  });

  await savePatientsDoc(newDoc);
  return newDoc;
}

// -----------------------------
// List Patients
// -----------------------------
export async function listPatientsCRDT() {
  const doc = await loadPatientsDoc();
  return doc.patients || {};
}
