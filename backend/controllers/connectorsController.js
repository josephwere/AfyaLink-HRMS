import Connector from '../models/Connector.js';
import ConnectorSlaEvent from "../models/ConnectorSlaEvent.js";
import axios from 'axios';
import { decrypt } from '../services/cryptoService.js';
import fhirAdapter from '../services/fhirAdapter.js';
import { recordConnectorSlaProbe } from "../services/connectorSlaService.js";

export async function createConnector(req,res){
  const body = req.body;
  // already handled in route earlier but keep for completeness
  const c = await Connector.create({ ...body, hospitalId: req.user?.hospitalId || null });
  res.json(c);
}

export async function listConnectors(req,res){
  const list = await Connector.find({ hospitalId: req.user?.hospitalId });
  res.json(list);
}

export async function testRestConnection(req,res){
  const startedAt = Date.now();
  try{
    const { connectorId } = req.params;
    const conn = await Connector.findById(connectorId);
    if(!conn) return res.status(404).json({ error: 'connector not found' });
    // prepare headers
    const headers = {};
    if(conn.authType === 'apikey' && conn.apiKey){
      headers['Authorization'] = 'Bearer ' + decrypt(conn.apiKey);
    } else if(conn.authType === 'basic' && conn.username && conn.password){
      const pw = decrypt(conn.password);
      headers['Authorization'] = 'Basic ' + Buffer.from(conn.username + ':' + pw).toString('base64');
    }
    // call health endpoint
    const r = await axios.get(conn.url + '/health', { headers, timeout: 8000 });
    await recordConnectorSlaProbe({
      connector: conn,
      operation: "REST_HEALTH",
      ok: true,
      statusCode: r.status,
      latencyMs: Date.now() - startedAt,
      actor: req.user,
    });
    res.json({ ok: true, status: r.status, data: r.data });
  }catch(err){
    try {
      const { connectorId } = req.params;
      const conn = await Connector.findById(connectorId);
      if (conn) {
        await recordConnectorSlaProbe({
          connector: conn,
          operation: "REST_HEALTH",
          ok: false,
          statusCode: err?.response?.status || 0,
          latencyMs: Date.now() - startedAt,
          errorMessage: err.message,
          actor: req.user,
        });
      }
    } catch (_) {}
    res.status(400).json({ ok:false, error: err.message, detail: err.response?.data || null });
  }
}

export async function testFHIR(req,res){
  const startedAt = Date.now();
  try{
    const { connectorId } = req.params;
    const conn = await Connector.findById(connectorId);
    if(!conn) return res.status(404).json({ error: 'connector not found' });
    const base = conn.url;
    const out = await fhirAdapter.testFHIRServer(base);
    await recordConnectorSlaProbe({
      connector: conn,
      operation: "FHIR_CAPABILITY",
      ok: true,
      statusCode: 200,
      latencyMs: Date.now() - startedAt,
      actor: req.user,
    });
    res.json({ ok:true, capability: out });
  }catch(err){
    try {
      const { connectorId } = req.params;
      const conn = await Connector.findById(connectorId);
      if (conn) {
        await recordConnectorSlaProbe({
          connector: conn,
          operation: "FHIR_CAPABILITY",
          ok: false,
          statusCode: err?.response?.status || 0,
          latencyMs: Date.now() - startedAt,
          errorMessage: err.message,
          actor: req.user,
        });
      }
    } catch (_) {}
    res.status(400).json({ ok:false, error: err.message });
  }
}

export async function connectorAnalytics(req,res){
  // basic analytics: lastSync and success/fail counts
  const data = await Connector.aggregate([
    { $match: {} },
    { $project: { name:1, type:1, status:1, lastSync:1 } },
    { $sort: { lastSync: -1 } }
  ]);
  res.json(data);
}

export async function connectorSlaSummary(req, res) {
  try {
    const hospitalId = req.user?.hospitalId || null;
    const windowHours = Math.min(Math.max(Number(req.query.windowHours) || 24, 1), 24 * 14);
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

    const match = { createdAt: { $gte: since } };
    if (hospitalId) match.hospitalId = hospitalId;

    const rows = await ConnectorSlaEvent.aggregate([
      { $match: match },
      {
        $group: {
          _id: { connectorId: "$connectorId", operation: "$operation" },
          total: { $sum: 1 },
          okTotal: { $sum: { $cond: ["$ok", 1, 0] } },
          breachTotal: { $sum: { $cond: ["$breach", 1, 0] } },
          avgLatencyMs: { $avg: "$latencyMs" },
          maxLatencyMs: { $max: "$latencyMs" },
          lastSeenAt: { $max: "$createdAt" },
        },
      },
      {
        $project: {
          _id: 0,
          connectorId: "$_id.connectorId",
          operation: "$_id.operation",
          total: 1,
          okTotal: 1,
          breachTotal: 1,
          successRate: {
            $cond: [{ $gt: ["$total", 0] }, { $divide: ["$okTotal", "$total"] }, 0],
          },
          breachRate: {
            $cond: [{ $gt: ["$total", 0] }, { $divide: ["$breachTotal", "$total"] }, 0],
          },
          avgLatencyMs: { $round: ["$avgLatencyMs", 2] },
          maxLatencyMs: 1,
          lastSeenAt: 1,
        },
      },
      { $sort: { breachRate: -1, avgLatencyMs: -1 } },
    ]);

    return res.json({ windowHours, count: rows.length, summary: rows });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to load connector SLA summary" });
  }
}

export async function listConnectorSlaEvents(req, res) {
  try {
    const connectorId = req.params.connectorId;
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const filter = { connectorId };
    if (req.user?.hospitalId) filter.hospitalId = req.user.hospitalId;
    const events = await ConnectorSlaEvent.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
    return res.json({ count: events.length, events });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Failed to load connector SLA events" });
  }
}

export default {
  createConnector,
  listConnectors,
  testRestConnection,
  testFHIR,
  connectorAnalytics,
  connectorSlaSummary,
  listConnectorSlaEvents,
};
