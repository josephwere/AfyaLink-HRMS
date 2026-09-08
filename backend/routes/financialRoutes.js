import express from 'express';
import {
  createInvoice,
  createUsageLedgerEntry,
  getHospitalFinancialIntelligence,
  getRevenueIntelligence,
  listInvoices,
  recordPayment,
  submitInsuranceClaim,
  reconcile,
} from '../controllers/financialController.js';
import { protect } from '../middleware/authMiddleware.js';
import { permit } from '../middleware/roleMiddleware.js';
const router = express.Router();

router.post('/', protect, permit('HOSPITAL_ADMIN','SUPER_ADMIN'), createInvoice);
router.post('/invoice', protect, permit('HOSPITAL_ADMIN','SUPER_ADMIN'), createInvoice); // alias
router.get('/intelligence', protect, permit('HOSPITAL_ADMIN','HOSPITAL_ADMIN_ASSISTANT','SUPER_ADMIN','SYSTEM_ADMIN','DEVELOPER'), getRevenueIntelligence);
router.get('/hospital-intelligence', protect, permit('HOSPITAL_ADMIN','HOSPITAL_ADMIN_ASSISTANT','SUPER_ADMIN','SYSTEM_ADMIN','DEVELOPER'), getHospitalFinancialIntelligence);
router.post('/usage-ledger', protect, permit('HOSPITAL_ADMIN','SUPER_ADMIN','SYSTEM_ADMIN','DEVELOPER'), createUsageLedgerEntry);
router.get('/', protect, permit('HOSPITAL_ADMIN','SUPER_ADMIN','DOCTOR'), listInvoices);
router.post('/:id/pay', protect, permit('HOSPITAL_ADMIN','PATIENT','SUPER_ADMIN'), recordPayment);
router.post('/:id/claim', protect, permit('HOSPITAL_ADMIN','SUPER_ADMIN'), submitInsuranceClaim);
router.get('/reconcile', protect, permit('HOSPITAL_ADMIN','SUPER_ADMIN'), reconcile);

export default router;
