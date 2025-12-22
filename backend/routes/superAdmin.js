
import express from 'express';
const router = express.Router();
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import superAdmin from '../controllers/superAdmin.js';

router.use(authenticate, authorizeRoles("superadmin"));

router.post("/register-hospital-admin", superAdmin.registerHospitalAdmin);
router.get("/hospitals", superAdmin.getHospitals);

export default router;
