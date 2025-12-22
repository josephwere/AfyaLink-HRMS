import express from 'express';
import hospitalRoutes from './hospitalRoutes.js';
import userRoutes from './userRoutes.js';
import patientRoutes from './patientRoutes.js';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/patients', patientRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/reports', reportRoutes);
router.use('/labs', labRoutes);
router.use('/hospitals', hospitalRoutes);

export default router;
