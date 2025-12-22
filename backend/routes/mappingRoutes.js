import express from "express";
import protect from "../middleware/auth.js";
import { authorize } from "../middleware/authorize.js";

import {
  createHl7Mapping,
  getHl7Mappings,
  getHl7MappingById,
  updateHl7Mapping,
  deleteHl7Mapping,
} from "../controllers/mappingController.js";

const router = express.Router();

/* ======================================================
   📋 LIST ALL HL7 MAPPINGS
====================================================== */
router.get(
  "/",
  protect,
  authorize("admin", "read"),
  getHl7Mappings
);

/* ======================================================
   🔍 GET SINGLE HL7 MAPPING
====================================================== */
router.get(
  "/:id",
  protect,
  authorize("admin", "read"),
  getHl7MappingById
);

/* ======================================================
   ➕ CREATE HL7 MAPPING
====================================================== */
router.post(
  "/",
  protect,
  authorize("admin", "write"),
  createHl7Mapping
);

/* ======================================================
   ✏️ UPDATE HL7 MAPPING
====================================================== */
router.put(
  "/:id",
  protect,
  authorize("admin", "write"),
  updateHl7Mapping
);

/* ======================================================
   🗑 DELETE HL7 MAPPING
====================================================== */
router.delete(
  "/:id",
  protect,
  authorize("admin", "write"),
  deleteHl7Mapping
);

export default router;
