import express from 'express';
import { createPatient, listPatients } from '../controllers/crdtController.js';
import auth from '../middleware/auth.js';


const router = express.Router();

router.post('/patients', auth, createPatient);
router.get('/patients', auth, listPatients);

export default router;
