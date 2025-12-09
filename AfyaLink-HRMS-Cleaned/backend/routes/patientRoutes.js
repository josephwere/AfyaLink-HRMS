// routes/patientRoutes.js
import express from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import {
  getAllPatients,
  getPatientById,
  createPatient,
  updatePatient,
  deletePatient
} from '../controllers/patientController.js';

const router = express.Router();

// Hospital Admin, Doctor, Nurse
router.use(authenticate);

router.get('/', authorize(['hospitaladmin', 'doctor', 'nurse']), getAllPatients);
router.get('/:id', authorize(['hospitaladmin', 'doctor', 'nurse', 'patient']), getPatientById);

// Only hospital admin can create/update/delete
router.post('/', authorize(['hospitaladmin']), createPatient);
router.put('/:id', authorize(['hospitaladmin']), updatePatient);
router.delete('/:id', authorize(['hospitaladmin']), deletePatient);

export default router;
