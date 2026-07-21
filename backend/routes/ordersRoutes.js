import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { cancelOrder, createOrder, transitionOrder } from '../controllers/ordersController.js';

const router = express.Router();

router.post(
  '/',
  protect,
  requireRole('DOCTOR', 'LAB_TECH', 'HOSPITAL_ADMIN', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEVELOPER'),
  createOrder
);

router.post(
  '/:id/transition',
  protect,
  requireRole('DOCTOR', 'LAB_TECH', 'HOSPITAL_ADMIN', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEVELOPER'),
  transitionOrder
);

router.post(
  '/:id/cancel',
  protect,
  requireRole('DOCTOR', 'LAB_TECH', 'HOSPITAL_ADMIN', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEVELOPER'),
  cancelOrder
);

export default router;
