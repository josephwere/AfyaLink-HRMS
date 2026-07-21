import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { createLaboratoryOrder, transitionLaboratoryOrder } from '../controllers/laboratoryController.js';

const router = express.Router();

router.post(
  '/',
  protect,
  requireRole('DOCTOR', 'LAB_TECH', 'HOSPITAL_ADMIN', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEVELOPER'),
  createLaboratoryOrder
);

router.post(
  '/:id/transition',
  protect,
  requireRole('DOCTOR', 'LAB_TECH', 'HOSPITAL_ADMIN', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEVELOPER'),
  transitionLaboratoryOrder
);

export default router;
