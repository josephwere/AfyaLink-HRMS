import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/authorize.js";
import { abacGuard } from "../middleware/abacGuard.js";

import {
  createHl7Mapping,
  getHl7Mappings,
  getHl7MappingById,
  updateHl7Mapping,
  deleteHl7Mapping,
  previewMappingTransform,
  signMappingPayload,
  verifyMappingPayload,
  listMappingTemplates,
} from "../controllers/mappingController.js";

const router = express.Router();

/* ======================================================
   📋 LIST ALL HL7 MAPPINGS
====================================================== */
router.get(
  "/",
  protect,
  authorize("admin", "read"),
  abacGuard({ domain: "INTEROP", resource: "mapping_studio", action: "read", fallbackAllow: true }),
  getHl7Mappings
);

/* ======================================================
   🔍 GET SINGLE HL7 MAPPING
====================================================== */
router.get(
  "/:id",
  protect,
  authorize("admin", "read"),
  abacGuard({ domain: "INTEROP", resource: "mapping_studio", action: "read", fallbackAllow: true }),
  getHl7MappingById
);

/* ======================================================
   ➕ CREATE HL7 MAPPING
====================================================== */
router.post(
  "/",
  protect,
  authorize("admin", "write"),
  abacGuard({ domain: "INTEROP", resource: "mapping_studio", action: "write", fallbackAllow: true }),
  createHl7Mapping
);

/* ======================================================
   ✏️ UPDATE HL7 MAPPING
====================================================== */
router.put(
  "/:id",
  protect,
  authorize("admin", "write"),
  abacGuard({ domain: "INTEROP", resource: "mapping_studio", action: "write", fallbackAllow: true }),
  updateHl7Mapping
);

/* ======================================================
   🗑 DELETE HL7 MAPPING
====================================================== */
router.delete(
  "/:id",
  protect,
  authorize("admin", "write"),
  abacGuard({ domain: "INTEROP", resource: "mapping_studio", action: "write", fallbackAllow: true }),
  deleteHl7Mapping
);

router.get(
  "/catalog/templates",
  protect,
  authorize("admin", "read"),
  abacGuard({ domain: "INTEROP", resource: "mapping_studio", action: "read", fallbackAllow: true }),
  listMappingTemplates
);

router.post(
  "/preview",
  protect,
  authorize("admin", "read"),
  abacGuard({ domain: "INTEROP", resource: "mapping_studio", action: "read", fallbackAllow: true }),
  previewMappingTransform
);

router.post(
  "/sign",
  protect,
  authorize("admin", "write"),
  abacGuard({ domain: "INTEROP", resource: "mapping_studio", action: "write", fallbackAllow: true }),
  signMappingPayload
);

router.post(
  "/verify",
  protect,
  authorize("admin", "read"),
  abacGuard({ domain: "INTEROP", resource: "mapping_studio", action: "read", fallbackAllow: true }),
  verifyMappingPayload
);

export default router;
