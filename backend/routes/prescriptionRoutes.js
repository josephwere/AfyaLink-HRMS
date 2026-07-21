import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { createPrescriptionRuntimeController, transitionPrescriptionRuntimeController } from '../controllers/prescriptionController.js';

const router = express.Router();

router.post(
  '/',
  protect,
  requireRole('DOCTOR', 'PHARMACIST', 'HOSPITAL_ADMIN', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEVELOPER'),
  createPrescriptionRuntimeController
);

router.post(
  '/:id/transition',
  protect,
  requireRole('DOCTOR', 'PHARMACIST', 'HOSPITAL_ADMIN', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEVELOPER'),
  transitionPrescriptionRuntimeController
);

export default router;
