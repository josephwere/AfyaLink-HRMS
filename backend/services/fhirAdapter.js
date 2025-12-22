import fetch from 'node-fetch';

/**
 * ---------------------------------------------------------
 * 1) FHIR Server Tests
 * ---------------------------------------------------------
 */
export async function testFHIRServer(baseUrl) {
  const r = await fetch(baseUrl + '/metadata', { timeout: 10000 });
  if (!r.ok) throw new Error('FHIR server responded ' + r.status);
  return r.json();
}

/**
 * ---------------------------------------------------------
 * 2) Create Patient on FHIR Server
 * ---------------------------------------------------------
 */
export async function createPatient(baseUrl, patientResource, token) {
  const r = await fetch(baseUrl + '/Patient', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/fhir+json',
      ...(token ? { Authorization: 'Bearer ' + token } : {})
    },
    body: JSON.stringify(patientResource)
  });

  if (!r.ok) throw new Error('Failed to create patient: ' + r.status);
  return r.json();
}

/**
 * ---------------------------------------------------------
 * 3) REQUIRED: Map FHIR → AfyaLink Patient format
 * ---------------------------------------------------------
 */
export function mapFHIRToAfyaPatient(fhir) {
  if (!fhir) return null;

  return {
    firstName: fhir?.name?.[0]?.given?.[0] || "",
    lastName: fhir?.name?.[0]?.family || "",
    gender: fhir?.gender || "",
    birthDate: fhir?.birthDate || null,
    phone:
      fhir?.telecom?.find(t => t.system === "phone")?.value || "",
    email:
      fhir?.telecom?.find(t => t.system === "email")?.value || "",
    identifiers: fhir?.identifier || []
  };
}

/**
 * ---------------------------------------------------------
 * Default Export (ESM compatible)
 * ---------------------------------------------------------
 */
export default {
  testFHIRServer,
  createPatient,
  mapFHIRToAfyaPatient
};
