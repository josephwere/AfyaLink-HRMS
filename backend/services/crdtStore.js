import * as Automerge from "@automerge/automerge";
import fs from 'fs';
import mongoose from 'mongoose';

// A simple Mongo-backed document store for Automerge docs
let DocModel;
try{
  DocModel = mongoose.model('CrdtDoc');
}catch(e){
  const schema = new mongoose.Schema({
    docId: { type: String, index:true },
    docBin: Buffer,
    updatedAt: { type: Date, default: Date.now }
  });
  DocModel = mongoose.model('CrdtDoc', schema);
}

export async function loadDoc(docId){
  const rec = await DocModel.findOne({ docId });
  if(!rec) return Automerge.init();
  try{
    const bin = rec.docBin;
    const doc = Automerge.load(bin);
    return doc;
  }catch(e){
    console.error('crdt load failed', e);
    return Automerge.init();
  }
}

export async function saveDoc(docId, doc){
  const bin = Automerge.save(doc);
  let rec = await DocModel.findOne({ docId });
  if(!rec) rec = await DocModel.create({ docId, docBin: bin, updatedAt: new Date() });
  else { rec.docBin = bin; rec.updatedAt = new Date(); await rec.save(); }
  return rec;
}

// merge remote changes (binary changes array)
export function applyChanges(doc, changesBinaryArray){
  try{
    const [newDoc, patch] = Automerge.applyChanges(doc, changesBinaryArray);
    return newDoc;
  }catch(e){
    console.error('applyChanges error', e);
    return doc;
  }
}
export default { loadDoc, saveDoc, applyChanges };
