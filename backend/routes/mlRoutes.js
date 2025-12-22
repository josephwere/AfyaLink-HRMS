import express from 'express';
import { trainModel, predictModel } from '../controllers/mlController.js';
import { protect } from '../middleware/authMiddleware.js';
import { permit } from '../middleware/roleMiddleware.js';
const router = express.Router();

router.post('/train', protect, permit('SuperAdmin','HospitalAdmin'), trainModel);
router.post('/:modelId/predict', protect, permit('Doctor','HospitalAdmin'), predictModel);

export default router;
