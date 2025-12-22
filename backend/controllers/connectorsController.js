import Connector from '../models/Connector.js';
import axios from 'axios';
import { decrypt } from '../services/cryptoService.js';
import fhirAdapter from '../services/fhirAdapter.js';

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
    res.json({ ok: true, status: r.status, data: r.data });
  }catch(err){
    res.status(400).json({ ok:false, error: err.message, detail: err.response?.data || null });
  }
}

export async function testFHIR(req,res){
  try{
    const { connectorId } = req.params;
    const conn = await Connector.findById(connectorId);
    if(!conn) return res.status(404).json({ error: 'connector not found' });
    const base = conn.url;
    const out = await fhirAdapter.testFHIRServer(base);
    res.json({ ok:true, capability: out });
  }catch(err){ res.status(400).json({ ok:false, error: err.message }); }
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

export default { createConnector, listConnectors, testRestConnection, testFHIR, connectorAnalytics };
