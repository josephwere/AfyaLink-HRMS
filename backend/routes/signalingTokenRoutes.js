import express from 'express';
import { issueToken } from '../controllers/signalingController.js';
import { protect } from "../middleware/authMiddleware.js";


const router = express.Router();

router.get('/token', protect, issueToken);

export default router;
