import express from 'express';
import { createPatient, listPatients } from '../controllers/crdtController.js';
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";


const router = express.Router();
router.use(
  protect,
  requireRole(
    "SUPER_ADMIN",
    "SYSTEM_ADMIN",
    "HOSPITAL_ADMIN",
    "DEVELOPER",
    "DOCTOR",
    "NURSE"
  )
);

router.post('/patients', createPatient);
router.get('/patients', listPatients);

export default router;
