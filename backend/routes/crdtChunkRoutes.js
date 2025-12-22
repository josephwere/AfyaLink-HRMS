import express from 'express';
import ChunkUpload from '../models/ChunkUpload.js';
import crdtStore from '../services/crdtStore.js';
import * as Automerge from "@automerge/automerge";


const router = express.Router();

// POST /api/crdt/:docId/changes/chunk  { uploadId, index, total, data (base64) }
router.post('/:docId/changes/chunk', async (req, res) => {
  try{
    const { uploadId, index, total, data } = req.body;
    if(!uploadId || index===undefined || !data) return res.status(400).json({ error: 'uploadId, index, data required' });
    let up = await ChunkUpload.findOne({ uploadId });
    if(!up) up = await ChunkUpload.create({ uploadId, docId: req.params.docId, total, chunks: {} });
    up.chunks.set(String(index), data);
    if(total) up.total = total;
    await up.save();
    // check completion
    if(up.total && up.chunks.size >= up.total){
      // assemble
      const arr = [];
      for(let i=0;i<up.total;i++){ const b64 = up.chunks.get(String(i)); if(!b64) return res.status(500).json({ error: 'missing chunk ' + i }); arr.push(Buffer.from(b64,'base64')); }
      // combine changes into array of Uint8Arrays expected by crdtStore.applyChanges
      const changes = arr.map(b=>b);
      const doc = await crdtStore.loadDoc(req.params.docId);
      const newDoc = crdtStore.applyChanges(doc, changes);
      await crdtStore.saveDoc(req.params.docId, newDoc);
      up.completed = true; await up.save();
      return res.json({ ok:true, assembled:true });
    }
    res.json({ ok:true, received: up.chunks.size });
  }catch(err){ console.error('chunk upload error', err); res.status(500).json({ error: err.message }); }
});

// GET status
router.get('/:docId/changes/chunk/:uploadId', async (req,res)=>{
  const up = await ChunkUpload.findOne({ uploadId: req.params.uploadId });
  if(!up) return res.status(404).json({ error: 'not found' });
  res.json({ uploadId: up.uploadId, total: up.total, received: up.chunks ? Array.from(up.chunks.keys()).map(Number) : [] });
});

export default router;
