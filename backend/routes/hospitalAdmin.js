
import express from 'express';
const router = express.Router();
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import hospitalAdmin from '../controllers/hospitalAdmin.js';

router.use(authenticate, authorizeRoles("hospitaladmin"));

router.post("/register-staff", hospitalAdmin.registerStaff);
router.get("/staff", hospitalAdmin.getHospitalStaff);

export default router;
