import express from "express";
import * as Automerge from "@automerge/automerge"; // v2 package name
const router = express.Router();

/**
 * In-memory documents store (replace with Redis or Mongo later)
 */
const docs = {};

/**
 * Create new CRDT document
 */
router.post("/create", (req, res) => {
  const { docId, initial } = req.body;

  const doc = Automerge.from(initial || {});

  const binary = Automerge.save(doc);
  docs[docId] = binary;

  res.json({ ok: true, doc });
});

/**
 * Apply a CRDT change patch
 */
router.post("/update", (req, res) => {
  const { docId, changes } = req.body;

  if (!docs[docId]) return res.status(404).json({ ok: false, error: "Not found" });

  let doc = Automerge.load(docs[docId]);

  const [newDoc, patchInfo] = Automerge.applyChanges(doc, changes);
  docs[docId] = Automerge.save(newDoc);

  res.json({
    ok: true,
    doc: newDoc,
    patch: patchInfo
  });
});

/**
 * Fetch full document
 */
router.get("/:docId", (req, res) => {
  const id = req.params.docId;

  if (!docs[id]) return res.status(404).json({ ok: false, error: "Not found" });

  const doc = Automerge.load(docs[id]);

  res.json({ ok: true, doc });
});

export default router;
