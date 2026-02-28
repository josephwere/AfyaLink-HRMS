import express from 'express';
import { listDLQ, retryDLQItem } from '../controllers/dlqController.js';
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";



const router = express.Router();
router.use(protect, requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"));

// List DLQ items (latest 100)
router.get('/', listDLQ);

// Retry DLQ item by id: move back to main queue
router.post('/:id/retry', retryDLQItem);

export default router;
