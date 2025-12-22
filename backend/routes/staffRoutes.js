// routes/staffRoutes.js
import express from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import {
  getAllStaff,
  getStaffById,
  createStaff,
  updateStaff,
  deleteStaff
} from '../controllers/staffController.js';

const router = express.Router();

// Hospital Admin or Super Admin
router.use(authenticate, authorize(['hospitaladmin', 'superadmin']));

router.get('/', getAllStaff);
router.get('/:id', getStaffById);
router.post('/', createStaff);
router.put('/:id', updateStaff);
router.delete('/:id', deleteStaff);

export default router;
