import { test, expect } from '@playwright/test';
import { getAuthHeader, setupErrorListeners } from '../shared';

const errors: string[] = [];
const apiURL = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:5000';

test.beforeEach(({ page }) => {
  setupErrorListeners(page, errors);
});

test.describe('Workflow certification - billing', () => {
  test('billing handoff completes', async ({ playwright }) => {
    const context = await playwright.request.newContext();
    const headers = await getAuthHeader(context, 'SUPER_ADMIN');

    const patientRes = await context.post(`${apiURL}/api/patients`, {
      headers,
      data: {
        firstName: `Bill${Date.now()}`,
        lastName: 'Patient',
        dob: '1991-03-03',
        gender: 'MALE',
        nationalId: `ID-BILL-${Date.now().toString().slice(-4)}`,
        contact: '+254700555555',
        address: 'Billing Certification Ward',
      },
    });
    expect(patientRes.status()).toBe(201);
    const patientPayload = await patientRes.json();
    const patient = patientPayload.patient || patientPayload;
    const patientId = patient?._id || patient?.id;
    expect(patientId).toBeTruthy();

    const encounterRes = await context.post(`${apiURL}/api/encounters`, {
      headers,
      data: {
        patientId,
        type: 'OUTPATIENT',
        complaint: 'Billing certification scenario',
      },
    });
    expect(encounterRes.status()).toBe(201);
    const encounterPayload = await encounterRes.json();
    const encounter = encounterPayload.encounter || encounterPayload;
    const encounterId = encounter?._id || encounter?.id;
    expect(encounterId).toBeTruthy();

    const billingRes = await context.post(`${apiURL}/api/encounters/${encounterId}/billing-handoff`, { headers });
    expect(billingRes.status()).toBe(200);

    expect(errors).toEqual([]);
  });
});

test.afterAll(() => {
  if (errors.length) {
    console.error('Billing workflow certification errors:', errors);
  }
});
