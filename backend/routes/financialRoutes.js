import express from 'express';
import { createInvoice, listInvoices, recordPayment, submitInsuranceClaim, reconcile } from '../controllers/financialController.js';
import { protect } from '../middleware/authMiddleware.js';
import { permit } from '../middleware/roleMiddleware.js';
const router = express.Router();

router.post('/', protect, permit('HospitalAdmin','SuperAdmin'), createInvoice);
router.post('/invoice', protect, permit('HospitalAdmin','SuperAdmin'), createInvoice); // alias
router.get('/', protect, permit('HospitalAdmin','SuperAdmin','Doctor'), listInvoices);
router.post('/:id/pay', protect, permit('HospitalAdmin','Patient','SuperAdmin'), recordPayment);
router.post('/:id/claim', protect, permit('HospitalAdmin','SuperAdmin'), submitInsuranceClaim);
router.get('/reconcile', protect, permit('HospitalAdmin','SuperAdmin'), reconcile);

export default router;
