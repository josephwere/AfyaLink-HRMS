import express from 'express';
import { suggestSlot, patientRisk } from '../controllers/aiController.js';
import { protect } from '../middleware/authMiddleware.js';
const router = express.Router();

router.get('/slot', protect, suggestSlot);
router.post('/risk', protect, patientRisk);

export default router;
