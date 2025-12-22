import express from 'express';
import { requestTransfer, approveTransfer, rejectTransfer, completeTransfer } from '../controllers/transferController.js';
import { protect } from '../middleware/authMiddleware.js';
import { permit } from '../middleware/roleMiddleware.js';
const router = express.Router();

router.post('/', protect, permit('Doctor','HospitalAdmin'), requestTransfer);
router.post('/:id/approve', protect, permit('HospitalAdmin','SuperAdmin'), approveTransfer);
router.post('/:id/reject', protect, permit('HospitalAdmin','SuperAdmin'), rejectTransfer);
router.post('/:id/complete', protect, permit('HospitalAdmin','SuperAdmin'), completeTransfer);

export default router;
