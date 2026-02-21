import express from 'express';
import {
  trainModel,
  predictModel,
  staffingForecast,
  burnoutScore,
  causalImpact,
  digitalTwinSimulate,
} from '../controllers/mlController.js';
import { protect } from '../middleware/authMiddleware.js';
import { permit } from '../middleware/roleMiddleware.js';
import { abacGuard } from "../middleware/abacGuard.js";
const router = express.Router();

router.post('/train', protect, permit('SUPER_ADMIN','HOSPITAL_ADMIN'), trainModel);
router.post('/:modelId/predict', protect, permit('DOCTOR','HOSPITAL_ADMIN'), predictModel);
router.post('/staffing/forecast', protect, permit('SUPER_ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN', 'HR_MANAGER', 'DEVELOPER'), abacGuard({ domain: "AI", resource: "clinical_intelligence", action: "read", fallbackAllow: true }), staffingForecast);
router.post('/burnout/score', protect, permit('SUPER_ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN', 'HR_MANAGER', 'DOCTOR', 'NURSE', 'DEVELOPER'), abacGuard({ domain: "AI", resource: "clinical_intelligence", action: "read", fallbackAllow: true }), burnoutScore);
router.post('/causal/impact', protect, permit('SUPER_ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN', 'HR_MANAGER', 'DEVELOPER'), abacGuard({ domain: "AI", resource: "clinical_intelligence", action: "read", fallbackAllow: true }), causalImpact);
router.post('/digital-twin/simulate', protect, permit('SUPER_ADMIN', 'SYSTEM_ADMIN', 'HOSPITAL_ADMIN', 'DEVELOPER'), abacGuard({ domain: "AI", resource: "clinical_intelligence", action: "read", fallbackAllow: true }), digitalTwinSimulate);

export default router;
