import express from 'express';
import {
  createConnector,
  listConnectors,
  testRestConnection,
  testFHIR,
  connectorAnalytics,
  connectorSlaSummary,
  listConnectorSlaEvents,
  getConnectorSdkManifest,
  getConnectorRuntime,
  updateConnectorRuntime,
  acknowledgeConnectorCursor,
  ingestConnectorPayload,
} from '../controllers/connectorsController.js';
import { protect } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";

const router = express.Router();
router.use(
  protect,
  requireRole("SUPER_ADMIN", "SYSTEM_ADMIN", "HOSPITAL_ADMIN", "DEVELOPER")
);

router.post('/', createConnector);
router.get('/', listConnectors);
router.get('/sdk/manifest', getConnectorSdkManifest);
router.get('/:connectorId/runtime', getConnectorRuntime);
router.patch('/:connectorId/runtime', updateConnectorRuntime);
router.post('/:connectorId/runtime/cursor', acknowledgeConnectorCursor);
router.post('/:connectorId/ingest', ingestConnectorPayload);
router.get('/:connectorId/test', testRestConnection);
router.get('/:connectorId/test-fhir', testFHIR);
router.get('/:connectorId/sla-events', listConnectorSlaEvents);
router.get('/analytics/list', connectorAnalytics);
router.get('/analytics/sla-summary', connectorSlaSummary);

export default router;
