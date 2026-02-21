import express from "express";
import * as Automerge from "@automerge/automerge"; // v2 package name
import { protect } from "../middleware/authMiddleware.js";
import crdtStore from "../services/crdtStore.js";
const router = express.Router();

router.use(protect);

const validateDocId = (docId) =>
  typeof docId === "string" && docId.trim().length > 0 && docId.length <= 200;

/**
 * Create new CRDT document
 */
router.post("/create", async (req, res) => {
  const { docId, initial } = req.body;
  if (!validateDocId(docId)) {
    return res.status(400).json({ ok: false, error: "Invalid docId" });
  }

  try {
    const doc = Automerge.from(initial || {});
    await crdtStore.saveDoc(docId, doc);
    return res.json({ ok: true, doc });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * Apply a CRDT change patch
 */
router.post("/update", async (req, res) => {
  const { docId, changes } = req.body;
  if (!validateDocId(docId)) {
    return res.status(400).json({ ok: false, error: "Invalid docId" });
  }
  if (!Array.isArray(changes)) {
    return res.status(400).json({ ok: false, error: "changes must be an array" });
  }

  try {
    const doc = await crdtStore.loadDoc(docId);
    const normalized = changes.map((c) => {
      if (typeof c === "string") return Uint8Array.from(Buffer.from(c, "base64"));
      return c;
    });
    const [newDoc, patchInfo] = Automerge.applyChanges(doc, normalized);
    await crdtStore.saveDoc(docId, newDoc);

    return res.json({
      ok: true,
      doc: newDoc,
      patch: patchInfo
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * Apply changes for a specific document
 * POST /api/crdt/:docId/changes
 */
router.post("/:docId/changes", async (req, res) => {
  const { docId } = req.params;
  const { changes } = req.body || {};

  if (!validateDocId(docId)) {
    return res.status(400).json({ ok: false, error: "Invalid docId" });
  }
  if (!Array.isArray(changes)) {
    return res.status(400).json({ ok: false, error: "changes must be an array" });
  }

  try {
    const doc = await crdtStore.loadDoc(docId);
    const decodedChanges = changes.map((c) => {
      if (typeof c === "string") {
        return Uint8Array.from(Buffer.from(c, "base64"));
      }
      return c;
    });
    const [newDoc] = Automerge.applyChanges(doc, decodedChanges);
    await crdtStore.saveDoc(docId, newDoc);

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * Fetch full document
 */
router.get("/:docId", async (req, res) => {
  const id = req.params.docId;
  if (!validateDocId(id)) {
    return res.status(400).json({ ok: false, error: "Invalid docId" });
  }

  try {
    const doc = await crdtStore.loadDoc(id);
    const bin = Buffer.from(Automerge.save(doc)).toString("base64");
    return res.json({ ok: true, doc, bin });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
