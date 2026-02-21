import { webhookQueue } from '../services/webhookQueue.js';
import { parseHL7Patient } from '../services/hl7Parser.js';
import { mapFHIRToAfyaPatient } from '../services/fhirAdapter.js';
import Patient from '../models/Patient.js';
import Audit from '../models/Audit.js';

webhookQueue.process(async (job) => {
  const { body, source, attempt } = job.data;
  try {
    if (body.hl7) {
      const mapped = parseHL7Patient(body.hl7);
      const p = await Patient.create(mapped);
      await Audit.create({ actor: null, action: 'webhook.worker.hl7.import', target: 'Patient', details: { patientId: p._id } });
      return { ok: true };
    }
    if (body.resource && body.resource.resourceType === 'Patient') {
      const mapped = mapFHIRToAfyaPatient(body.resource);
      const p = await Patient.create(mapped);
      await Audit.create({ actor: null, action: 'webhook.worker.fhir.import', target: 'Patient', details: { patientId: p._id } });
      return { ok: true };
    }
    await Audit.create({ actor: null, action: 'webhook.worker.unknown', target: 'ConnectorEvent', details: { bodySummary: JSON.stringify(body).slice(0,200) } });
    return { ok: true };
  } catch (err) {
    console.error('webhook worker error', err);
    throw err;
  }
});
