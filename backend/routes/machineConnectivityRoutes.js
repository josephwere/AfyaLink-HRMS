import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { machineAuth } from "../middleware/machineAuthMiddleware.js";
import {
  bulkAcknowledgeMachineAlerts,
  acknowledgeMachineAlert,
  createMachineDevice,
  escalateMachineAlert,
  exportMachineAlertEvidenceBundle,
  exportMachineAlertTimelinePdf,
  exportMachineAlertTimelineCsv,
  getMachineAlertEvidenceManifest,
  getMachineAlertPolicyConfig,
  ingestLabMachineResult,
  listMachineAlerts,
  getMachineAlertTimeline,
  listMachineAudit,
  listMachineDevices,
  machineConnectivityOverview,
  machineHeartbeat,
  rotateMachineDeviceKey,
  testDicomStub,
  testHl7Parse,
  updateMachineAlertPolicyConfig,
  updateMachineDevice,
  verifyMachineAlertEvidenceManifest,
} from "../controllers/machineConnectivityController.js";

const router = express.Router();

// Admin/founder/device-ops
router.get(
  "/devices",
  protect,
  requireRole("HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  listMachineDevices
);

router.get(
  "/overview",
  protect,
  requireRole("HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  machineConnectivityOverview
);

router.get(
  "/audit",
  protect,
  requireRole("HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  listMachineAudit
);

router.get(
  "/alerts",
  protect,
  requireRole("HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  listMachineAlerts
);

router.get(
  "/alerts/:id/timeline",
  protect,
  requireRole("HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  getMachineAlertTimeline
);

router.get(
  "/alerts/:id/timeline.csv",
  protect,
  requireRole("HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  exportMachineAlertTimelineCsv
);

router.get(
  "/alerts/:id/timeline.pdf",
  protect,
  requireRole("HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  exportMachineAlertTimelinePdf
);

router.get(
  "/alerts/:id/evidence-manifest",
  protect,
  requireRole("HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  getMachineAlertEvidenceManifest
);

router.get(
  "/alerts/:id/evidence-bundle",
  protect,
  requireRole("HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  exportMachineAlertEvidenceBundle
);

router.post(
  "/alerts/verify-manifest",
  protect,
  requireRole("HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  verifyMachineAlertEvidenceManifest
);

router.patch(
  "/alerts/:id/ack",
  protect,
  requireRole("HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  acknowledgeMachineAlert
);

router.patch(
  "/alerts/ack-bulk",
  protect,
  requireRole("HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  bulkAcknowledgeMachineAlerts
);

router.get(
  "/alerts/policy",
  protect,
  requireRole("HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  getMachineAlertPolicyConfig
);

router.put(
  "/alerts/policy",
  protect,
  requireRole("HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  updateMachineAlertPolicyConfig
);

router.post(
  "/alerts/:id/escalate",
  protect,
  requireRole("HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  escalateMachineAlert
);

router.post(
  "/devices",
  protect,
  requireRole("HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  createMachineDevice
);

router.patch(
  "/devices/:id",
  protect,
  requireRole("HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  updateMachineDevice
);

router.post(
  "/devices/:id/rotate-key",
  protect,
  requireRole("HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  rotateMachineDeviceKey
);

router.post(
  "/test/hl7-parse",
  protect,
  requireRole("HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  testHl7Parse
);

router.post(
  "/test/dicom-stub",
  protect,
  requireRole("HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"),
  testDicomStub
);

// Machine-facing (key auth)
router.post("/heartbeat", machineAuth, machineHeartbeat);
router.post("/lab-results", machineAuth, ingestLabMachineResult);

export default router;
