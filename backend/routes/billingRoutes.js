import express from 'express';
const router = express.Router();

import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import {
  index,
  list,
  getOne,
  invoicePdf
} from '../controllers/billingController.js';

router.use(protect);

// Dashboard summary
router.get(
  '/',
  requireRole(
    "SUPER_ADMIN",
    "SYSTEM_ADMIN",
    "HOSPITAL_ADMIN",
    "PAYROLL_OFFICER",
    "DEVELOPER"
  ),
  index
);

// All transactions
router.get(
  '/list',
  requireRole(
    "SUPER_ADMIN",
    "SYSTEM_ADMIN",
    "HOSPITAL_ADMIN",
    "PAYROLL_OFFICER",
    "DEVELOPER",
    "PATIENT"
  ),
  list
);

// Invoice PDF
router.get(
  '/invoice/:id',
  requireRole(
    "SUPER_ADMIN",
    "SYSTEM_ADMIN",
    "HOSPITAL_ADMIN",
    "PAYROLL_OFFICER",
    "DEVELOPER",
    "PATIENT"
  ),
  invoicePdf
);

// Single transaction
router.get(
  '/:id',
  requireRole(
    "SUPER_ADMIN",
    "SYSTEM_ADMIN",
    "HOSPITAL_ADMIN",
    "PAYROLL_OFFICER",
    "DEVELOPER"
  ),
  getOne
);

export default router;
