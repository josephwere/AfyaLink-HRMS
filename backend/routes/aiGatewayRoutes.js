import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/requireRole.js";
import { requireRecentStepUp } from "../middleware/riskAdaptiveAuth.js";
import { abacGuard } from "../middleware/abacGuard.js";
import {
  gatewayExtract,
  gatewayIngest,
  gatewaySearch,
  gatewayFhirTransform,
  gatewayHl7Transform,
  gatewayRiskStaffingForecast,
  gatewayRiskBurnoutScore,
  gatewayRiskCausalImpact,
  gatewayDigitalTwin,
  gatewayJobStatus,
  gatewayHealth,
} from "../controllers/aiGatewayController.js";

const router = express.Router();
router.use(protect);

const AI_BASE_ROLES = [
  "SUPER_ADMIN",
  "SYSTEM_ADMIN",
  "DEVELOPER",
  "HOSPITAL_ADMIN",
  "HR_MANAGER",
  "DOCTOR",
  "NURSE",
  "LAB_TECH",
  "PHARMACIST",
  "RADIOLOGIST",
  "THERAPIST",
  "RECEPTIONIST",
  "COMMUNITY_HEALTH_WORKER",
];

const AI_RISK_ROLES = [
  "SUPER_ADMIN",
  "SYSTEM_ADMIN",
  "DEVELOPER",
  "HOSPITAL_ADMIN",
  "HR_MANAGER",
];

const AI_TRANSFORM_ROLES = [
  "SUPER_ADMIN",
  "SYSTEM_ADMIN",
  "DEVELOPER",
  "HOSPITAL_ADMIN",
  "DOCTOR",
  "LAB_TECH",
];

const aiReadAbac = abacGuard({
  domain: "AI",
  resource: "neuroedge_gateway",
  action: "read",
  fallbackAllow: true,
});

const aiWriteAbac = abacGuard({
  domain: "AI",
  resource: "neuroedge_gateway",
  action: "write",
  fallbackAllow: true,
});

router.post(
  "/extract",
  requireRole(...AI_BASE_ROLES),
  aiWriteAbac,
  gatewayExtract
);

router.post(
  "/ingest",
  requireRole(...AI_BASE_ROLES),
  aiWriteAbac,
  gatewayIngest
);

router.post(
  "/search",
  requireRole(...AI_BASE_ROLES),
  aiReadAbac,
  gatewaySearch
);

router.post(
  "/fhir-transform",
  requireRole(...AI_TRANSFORM_ROLES),
  requireRecentStepUp(20),
  aiWriteAbac,
  gatewayFhirTransform
);

router.post(
  "/hl7-transform",
  requireRole(...AI_TRANSFORM_ROLES),
  requireRecentStepUp(20),
  aiWriteAbac,
  gatewayHl7Transform
);

router.post(
  "/risk/staffing-forecast",
  requireRole(...AI_RISK_ROLES),
  aiReadAbac,
  gatewayRiskStaffingForecast
);

router.post(
  "/risk/burnout-score",
  requireRole(...AI_RISK_ROLES),
  aiReadAbac,
  gatewayRiskBurnoutScore
);

router.post(
  "/risk/causal-impact",
  requireRole(...AI_RISK_ROLES),
  aiReadAbac,
  gatewayRiskCausalImpact
);

router.post(
  "/simulate/digital-twin",
  requireRole(...AI_RISK_ROLES),
  requireRecentStepUp(20),
  aiReadAbac,
  gatewayDigitalTwin
);

router.get(
  "/health",
  requireRole(...AI_RISK_ROLES),
  aiReadAbac,
  gatewayHealth
);

router.get(
  "/jobs/:jobId",
  requireRole(...AI_BASE_ROLES),
  aiReadAbac,
  gatewayJobStatus
);

export default router;
