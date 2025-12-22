import express from 'express';
import { createPatient, getPatient, searchPatients } from '../controllers/patientController.js';
import { protect } from '../middleware/authMiddleware.js';
const router = express.Router();

router.post('/', protect, createPatient);
router.get('/search', protect, searchPatients);
router.get('/:id', protect, getPatient);

export default router;
