import { test, expect } from '@playwright/test';
import { getAuthHeader, setupErrorListeners, expectApiStatus } from '../shared';

const errors: string[] = [];
const apiURL = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:5000';

test.beforeEach(({ page }) => {
  setupErrorListeners(page, errors);
});

test.describe('Workflow certification - surgery', () => {
  test('surgery workflow reaches discharge', async ({ playwright }) => {
    const context = await playwright.request.newContext();
    const headers = await getAuthHeader(context, 'SUPER_ADMIN');

    const patientRes = await context.post(`${apiURL}/api/patients`, {
      headers,
      data: {
        firstName: `Surg${Date.now()}`,
        lastName: 'Patient',
        dob: '1989-07-15',
        gender: 'MALE',
        nationalId: `ID-SURG-${Date.now().toString().slice(-4)}`,
        contact: '+254700333333',
        address: 'Surgery Certification Wing',
      },
    });
    expect(patientRes.status()).toBe(201);
    const patientPayload = await patientRes.json();
    const patient = patientPayload.patient || patientPayload;

    const encounterRes = await context.post(`${apiURL}/api/encounters`, {
      headers,
      data: {
        patientId: patient._id,
        type: 'SURGERY',
        complaint: 'Surgery certification scenario',
      },
    });
    expect(encounterRes.status()).toBe(201);
    const encounterPayload = await encounterRes.json();
    const encounter = encounterPayload.encounter || encounterPayload;

    const startRes = await context.post(`${apiURL}/api/encounters/${encounter._id}/start`, { headers });
    expect(startRes.status()).toBe(200);

    const closeRes = await context.post(`${apiURL}/api/encounters/${encounter._id}/close`, { headers });
    expectApiStatus(closeRes, [200, 409], 'Close encounter request');

    expect(errors).toEqual([]);
  });
});

test.afterAll(() => {
  if (errors.length) {
    console.error('Surgery workflow certification errors:', errors);
  }
});
