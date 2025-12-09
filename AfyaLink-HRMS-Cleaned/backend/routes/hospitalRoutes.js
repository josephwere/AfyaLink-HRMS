// routes/hospitalRoutes.js
import express from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import {
  getAllHospitals,
  getHospitalById,
  createHospital,
  updateHospital,
  deleteHospital
} from '../controllers/hospitalController.js';

const router = express.Router();

// Only superadmin can manage hospitals
router.use(authenticate, authorize(['superadmin']));

router.get('/', getAllHospitals);
router.get('/:id', getHospitalById);
router.post('/', createHospital);
router.put('/:id', updateHospital);
router.delete('/:id', deleteHospital);

export default router;
