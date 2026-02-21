import { integrationQueue, integrationDLQ } from '../services/integrationQueue.js';
import Connector from '../models/Connector.js';
import { decrypt } from '../services/cryptoService.js';
import { parseHL7Patient, parseHL7ToSegments, getHL7Field } from '../services/hl7Parser.js';
import { mapFHIRToAfyaPatient } from '../services/fhirAdapter.js';
import Patient from '../models/Patient.js';
import Audit from '../models/Audit.js';
import Mapping from '../models/Mapping.js';

// Process jobs: support HL7 or FHIR, apply mapping if provided
integrationQueue.process(async (job) => {
  const { connectorId, payload, sig } = job.data;
  const connector = await Connector.findById(connectorId);
  if(!connector) throw new Error('Connector not found');
  // Verify signature if webhookSecret present
  if(connector.webhookSecret){
    const ok = (function(){
      try{
        const h = require('crypto').createHmac('sha256', connector.webhookSecret).update(payload).digest('hex');
        return h === sig;
      }catch(e){ return false; }
    })();
    if(!ok){
      await Audit.create({ action:'integration_webhook_failed', details:{ connector: connectorId, reason:'invalid signature' } });
      throw new Error('Invalid signature');
    }
  }

  // Load mapping for this connector/hospital if exists
  const mapping = await Mapping.findOne({ connector: connector._id }).lean();

  // try parse JSON => FHIR
  let parsedJson = null;
  try{ parsedJson = JSON.parse(payload); }catch(e){ parsedJson = null; }

  if(parsedJson && parsedJson.resourceType === 'Patient'){
    // Map FHIR to Afya patient, then apply mapping overrides (if mapping.fields defined for fhir path)
    let mapped = mapFHIRToAfyaPatient(parsedJson);
    if(mapping && mapping.fields && mapping.fields.fhir){
      for(const [fpath, target] of Object.entries(mapping.fields.fhir)){
        // simple dot path extraction
        const parts = fpath.split('.');
        let val = parsedJson;
        for(const p of parts){ if(val) val = val[p]; else break; }
        if(val !== undefined && target) mapped[target] = val;
      }
    }
    const created = await Patient.create(mapped);
    await Audit.create({ action:'integration_import_fhir', details:{ connector:connectorId, patientId: created._id } });
    return { ok:true, type:'fhir', patientId: created._id };
  } else {
    // HL7 path: parse into segments and extract using mapping if present
    const segments = parseHL7ToSegments(payload); // returns array of segments objects
    let mappedObj = {};
    if(mapping && mapping.fields && mapping.fields.hl7){
      // mapping.fields.hl7: { "PID-5.1": "firstName", "PID-5.0": "lastName" ... }
      for(const [hl7path, target] of Object.entries(mapping.fields.hl7)){
        const val = getHL7Field(segments, hl7path);
        if(val !== undefined && target) mappedObj[target] = val;
      }
    } else {
      // default parse
      mappedObj = parseHL7Patient(payload);
    }
    const created = await Patient.create(mappedObj);
    await Audit.create({ action:'integration_import_hl7', details:{ connector:connectorId, patientId: created._id } });
    return { ok:true, type:'hl7', patientId: created._id };
  }
});

integrationQueue.on('completed', (job, res)=> console.log('integration job completed', job.id, res));
integrationQueue.on('failed', (job, err)=> console.error('integration job failed', job.id, err));
integrationDLQ.on('completed', (job,res)=> console.log('DLQ processed', job.id));
