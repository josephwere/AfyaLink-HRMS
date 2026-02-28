import express from 'express';
import { listDLQ, getDLQItem, updateDLQItem, retryDLQItem } from '../controllers/dlqController.js';
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";


const router = express.Router();
router.use(protect, requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"));

// GET DLQ items
router.get('/', listDLQ);

// GET single job
router.get('/:id', getDLQItem);

// PUT edit job data
router.put('/:id', updateDLQItem);

// Retry edited job: move to main queue
router.post('/:id/retry', retryDLQItem);

export default router;
