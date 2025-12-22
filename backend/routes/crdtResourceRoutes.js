import express from 'express';
import crdtStore from '../services/crdtStore.js';
const router = express.Router();

// Generic endpoints:
// GET /api/crdt/resource/:resource/:id  -> get full doc
// POST /api/crdt/resource/:resource/:id/changes -> push changes (array base64 changes)

router.get('/:resource/:id', async (req,res)=>{
  try{
    const docId = `${req.params.resource}:${req.params.id}`;
    const doc = await crdtStore.loadDoc(docId);
    const bin = Automerge.save(doc);
    res.json({ ok:true, bin: Buffer.from(bin).toString('base64') });
  }catch(err){ res.status(500).json({ error: err.message }); }
});

router.post('/:resource/:id/changes', async (req,res)=>{
  try{
    const docId = `${req.params.resource}:${req.params.id}`;
    const changes = req.body.changes || [];
    const doc = await crdtStore.loadDoc(docId);
    const changesBufs = changes.map(c=>Buffer.from(c,'base64'));
    const newDoc = crdtStore.applyChanges(doc, changesBufs);
    await crdtStore.saveDoc(docId, newDoc);
    res.json({ ok:true });
  }catch(err){ res.status(500).json({ error: err.message }); }
});

export default router;
