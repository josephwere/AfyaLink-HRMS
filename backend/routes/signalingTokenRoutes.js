import express from 'express';
import { issueToken } from '../controllers/signalingController.js';
import auth from '../middleware/auth.js';


const router = express.Router();

router.get('/token', auth, issueToken);

export default router;
