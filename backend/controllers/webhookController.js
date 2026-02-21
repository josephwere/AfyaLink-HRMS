import Connector from '../models/Connector.js';
import Audit from '../models/Audit.js';
import { parseHL7Patient } from '../services/hl7Parser.js';
import { mapFHIRToAfyaPatient } from '../services/fhirAdapter.js';
import Patient from '../models/Patient.js';
import crypto from "crypto";

function verifySignature(secret, payload, signature) {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function receiveWebhook(req, res) {
  try {
    const source = req.params.source || 'unknown';
    const signature = req.headers['x-afya-signature'] || req.headers['x-signature'] || null;
    const body = req.body;
    const connector = await Connector.findOne({ name: source, isActive: true }).lean();
    if (!connector) {
      return res.status(404).json({ error: "Connector not found or inactive" });
    }
    const secret =
      connector?.config?.webhookSecret ||
      process.env.WEBHOOK_SHARED_SECRET ||
      process.env.INTEGRATION_WEBHOOK_SECRET;
    if (!secret) {
      return res.status(503).json({ error: "Webhook secret is not configured" });
    }
    const payload = JSON.stringify(body || {});
    if (!verifySignature(secret, payload, signature)) {
      await Audit.create({
        actor: null,
        action: 'webhook.denied.invalid_signature',
        target: source,
        details: { ip: req.ip },
        ip: req.ip,
      });
      return res.status(401).json({ error: "Invalid webhook signature" });
    }

    await Audit.create({ actor: null, action: 'webhook.receive', target: source, details: { ip: req.ip, bodySummary: JSON.stringify(body).slice(0,200) }, ip: req.ip });

    const connectorHospital = connector?.config?.hospitalId || null;
    if (!connectorHospital) {
      return res.status(400).json({ error: "Connector hospitalId is required" });
    }

    // If body contains HL7 message (raw) -> parse and create patient
    if (body.hl7) {
      const mapped = { ...parseHL7Patient(body.hl7), hospital: connectorHospital };
      const p = await Patient.create(mapped);
      await Audit.create({ actor: null, action: 'webhook.hl7.import', target: 'Patient', details: { patientId: p._id }, ip: req.ip });
      return res.json({ ok: true, created: p._id });
    }

    // If body contains FHIR resource
    if (body.resource && body.resource.resourceType === 'Patient') {
      const mapped = { ...mapFHIRToAfyaPatient(body.resource), hospital: connectorHospital };
      const p = await Patient.create(mapped);
      await Audit.create({ actor: null, action: 'webhook.fhir.import', target: 'Patient', details: { patientId: p._id }, ip: req.ip });
      return res.json({ ok: true, created: p._id });
    }

    // Otherwise store event and acknowledge
    await Audit.create({ actor: null, action: 'webhook.unknown', target: 'ConnectorEvent', details: { body: body }, ip: req.ip });
    res.json({ ok: true });
  } catch (err) {
    console.error('webhook receive error', err);
    res.status(500).json({ error: 'processing error' });
  }
}
