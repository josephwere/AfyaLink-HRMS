import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import {
  getSystemAdminMetrics,
  getAdaptiveRiskPolicy,
  updateAdaptiveRiskPolicy,
  getAbacPolicies,
  upsertAbacPolicy,
  deleteAbacPolicy,
  simulateAbacPolicy,
  getAbacTestCases,
  upsertAbacTestCase,
  deleteAbacTestCase,
  runAbacTestCase,
  runAllAbacTestCases,
} from "../controllers/systemAdminController.js";

const router = express.Router();

router.get(
  "/metrics",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN"),
  getSystemAdminMetrics
);

router.get(
  "/risk-policy",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN"),
  getAdaptiveRiskPolicy
);

router.put(
  "/risk-policy",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN"),
  updateAdaptiveRiskPolicy
);

router.get(
  "/abac-policies",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"),
  getAbacPolicies
);

router.post(
  "/abac-policies",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"),
  upsertAbacPolicy
);

router.put(
  "/abac-policies/:id",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"),
  upsertAbacPolicy
);

router.delete(
  "/abac-policies/:id",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"),
  deleteAbacPolicy
);

router.post(
  "/abac-simulate",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"),
  simulateAbacPolicy
);

router.get(
  "/abac-test-cases",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"),
  getAbacTestCases
);

router.post(
  "/abac-test-cases",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"),
  upsertAbacTestCase
);

router.put(
  "/abac-test-cases/:id",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"),
  upsertAbacTestCase
);

router.delete(
  "/abac-test-cases/:id",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"),
  deleteAbacTestCase
);

router.post(
  "/abac-test-cases/:id/run",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"),
  runAbacTestCase
);

router.post(
  "/abac-test-cases/run-all",
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"),
  runAllAbacTestCases
);

export default router;
