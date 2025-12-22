import Connector from '../models/Connector.js';
import Audit from '../models/Audit.js';
import { sendWebhook } from '../routes/webhookSender.js'; // reuse sender if needed
import { parseHL7Patient } from '../services/hl7Parser.js';
import { mapFHIRToAfyaPatient } from '../services/fhirAdapter.js';
import Patient from '../models/Patient.js';

export async function receiveWebhook(req, res) {
  try {
    const source = req.params.source || 'unknown';
    const signature = req.headers['x-afya-signature'] || req.headers['x-signature'] || null;
    const body = req.body;

    // Basic validation - in production verify signature using connector secret
    await Audit.create({ actor: null, action: 'webhook.receive', target: source, details: { ip: req.ip, bodySummary: JSON.stringify(body).slice(0,200) }, ip: req.ip });

    // If body contains HL7 message (raw) -> parse and create patient
    if (body.hl7) {
      const mapped = parseHL7Patient(body.hl7);
      const p = await Patient.create(mapped);
      await Audit.create({ actor: null, action: 'webhook.hl7.import', target: 'Patient', details: { patientId: p._id }, ip: req.ip });
      return res.json({ ok: true, created: p._id });
    }

    // If body contains FHIR resource
    if (body.resource && body.resource.resourceType === 'Patient') {
      const mapped = mapFHIRToAfyaPatient(body.resource);
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
