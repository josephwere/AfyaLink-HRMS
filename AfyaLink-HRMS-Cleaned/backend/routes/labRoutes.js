// routes/labRoutes.js
import express from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import {
  getLabTests,
  getLabTestById,
  createLabRequest,
  updateLabResult
} from '../controllers/labController.js';

const router = express.Router();

router.use(authenticate);

// Doctors can create lab requests, labtech can update results
router.get('/', authorize(['hospitaladmin', 'doctor', 'labtech']), getLabTests);
router.get('/:id', authorize(['hospitaladmin', 'doctor', 'labtech']), getLabTestById);
router.post('/', authorize(['doctor']), createLabRequest);
router.put('/:id', authorize(['labtech']), updateLabResult);

export default router;
