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
router.use(
  requireRole(
    "SUPER_ADMIN",
    "SYSTEM_ADMIN",
    "HOSPITAL_ADMIN",
    "PAYROLL_OFFICER",
    "DEVELOPER"
  )
);

// Dashboard summary
router.get('/', index);

// All transactions
router.get('/list', list);

// Invoice PDF
router.get('/invoice/:id', invoicePdf);

// Single transaction
router.get('/:id', getOne);

export default router;
