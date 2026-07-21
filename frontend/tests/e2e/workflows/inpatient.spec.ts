import { test, expect } from '@playwright/test';
import { getAuthHeader, setupErrorListeners } from '../shared';

const errors: string[] = [];
const apiURL = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:5000';

test.beforeEach(({ page }) => {
  setupErrorListeners(page, errors);
});

test.describe('Workflow certification - inpatient', () => {
  test('admission workflow reaches discharge', async ({ playwright }) => {
    const context = await playwright.request.newContext();
    const headers = await getAuthHeader(context, 'SUPER_ADMIN');

    const patientRes = await context.post(`${apiURL}/api/patients`, {
      headers,
      data: {
        firstName: `Inpat${Date.now()}`,
        lastName: 'Patient',
        dob: '1976-02-02',
        gender: 'FEMALE',
        nationalId: `ID-INPT-${Date.now().toString().slice(-4)}`,
        contact: '+254700222222',
        address: 'Inpatient Certification Wing',
      },
    });
    expect(patientRes.status()).toBe(201);
    const patientPayload = await patientRes.json();
    const patient = patientPayload.patient || patientPayload;

    const encounterRes = await context.post(`${apiURL}/api/encounters`, {
      headers,
      data: {
        patientId: patient._id,
        type: 'INPATIENT',
        complaint: 'Inpatient admission certification',
      },
    });
    expect(encounterRes.status()).toBe(201);
    const encounterPayload = await encounterRes.json();
    const encounter = encounterPayload.encounter || encounterPayload;

    const startRes = await context.post(`${apiURL}/api/encounters/${encounter._id}/start`, { headers });
    expect(startRes.status()).toBe(200);

    const closeoutRes = await context.post(`${apiURL}/api/encounters/${encounter._id}/closeout-effects`, {
      headers,
      data: {
        diagnosis: 'Inpatient certification discharge',
        labTests: ['CBC'],
      },
    });
    expect(closeoutRes.status()).toBe(200);

    const billingRes = await context.post(`${apiURL}/api/encounters/${encounter._id}/billing-handoff`, { headers });
    expect(billingRes.status()).toBe(200);

    const closeRes = await context.post(`${apiURL}/api/encounters/${encounter._id}/close`, { headers });
    expect(closeRes.status()).toBe(200);

    expect(errors).toEqual([]);
  });
});

test.afterAll(() => {
  if (errors.length) {
    console.error('Inpatient workflow certification errors:', errors);
  }
});
