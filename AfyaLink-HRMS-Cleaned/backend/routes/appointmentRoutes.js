// routes/appointmentRoutes.js
import express from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import {
  getAllAppointments,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  deleteAppointment
} from '../controllers/appointmentController.js';

const router = express.Router();

router.use(authenticate);

router.get('/', authorize(['hospitaladmin', 'doctor', 'nurse', 'patient']), getAllAppointments);
router.get('/:id', authorize(['hospitaladmin', 'doctor', 'nurse', 'patient']), getAppointmentById);
router.post('/', authorize(['hospitaladmin', 'doctor', 'patient']), createAppointment);
router.put('/:id', authorize(['hospitaladmin', 'doctor']), updateAppointment);
router.delete('/:id', authorize(['hospitaladmin', 'doctor']), deleteAppointment);

export default router;
