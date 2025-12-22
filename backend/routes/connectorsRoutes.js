import express from 'express';
import {
  createConnector,
  listConnectors,
  testRestConnection,
  testFHIR,
  connectorAnalytics
} from '../controllers/connectorsController.js';

import auth from '../middleware/auth.js'; // ✅ FIX HERE

const router = express.Router();

router.post('/', auth, createConnector);
router.get('/', auth, listConnectors);
router.get('/:connectorId/test', auth, testRestConnection);
router.get('/:connectorId/test-fhir', auth, testFHIR);
router.get('/analytics/list', auth, connectorAnalytics);

export default router;
