import express from 'express';
import { listDLQ, getDLQItem, editAndRetry, updateRetryPolicy } from '../controllers/dlqController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

router.get('/', auth, listDLQ);
router.get('/:id', auth, getDLQItem);
router.post('/:id/edit-retry', auth, editAndRetry);
router.post('/connector/:connectorId/retry-policy', auth, updateRetryPolicy);

export default router;
