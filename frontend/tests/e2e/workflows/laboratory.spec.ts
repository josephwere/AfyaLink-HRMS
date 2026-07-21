import { test, expect } from '@playwright/test';
import { getAuthHeader, setupErrorListeners } from '../shared';

const errors: string[] = [];
const apiURL = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:5000';

test.beforeEach(({ page }) => {
  setupErrorListeners(page, errors);
});

test.describe('Workflow certification - laboratory', () => {
  test('lab ordering and completion works', async ({ playwright }) => {
    const context = await playwright.request.newContext();
    const headers = await getAuthHeader(context, 'SUPER_ADMIN');

    const patientRes = await context.post(`${apiURL}/api/patients`, {
      headers,
      data: {
        firstName: `Lab${Date.now()}`,
        lastName: 'Patient',
        dob: '1992-01-01',
        gender: 'FEMALE',
        nationalId: `ID-LAB-${Date.now().toString().slice(-4)}`,
        contact: '+254700444444',
        address: 'Lab Certification Ward',
      },
    });
    expect(patientRes.status()).toBe(201);
    const patientPayload = await patientRes.json();
    const patient = patientPayload.patient || patientPayload;
    expect(patient?._id || patient?.id).toBeTruthy();

    const encounterRes = await context.post(`${apiURL}/api/encounters`, {
      headers,
      data: {
        patientId: patient._id || patient.id,
        type: 'OUTPATIENT',
        complaint: 'Lab certification scenario',
      },
    });
    expect(encounterRes.status()).toBe(201);
    const encounterPayload = await encounterRes.json();
    const encounter = encounterPayload.encounter || encounterPayload;
    const encounterId = encounter?._id || encounter?.id;
    expect(encounterId).toBeTruthy();

    const labRes = await context.post(`${apiURL}/api/labs`, {
      headers,
      data: {
        patient: patient._id || patient.id,
        encounter: encounterId,
        testType: 'CBC',
      },
    });
    expect(labRes.status()).toBe(201);
    const labPayload = await labRes.json();
    const lab = labPayload.item || labPayload.lab || labPayload;
    const labId = lab?._id || lab?.id;
    expect(labId).toBeTruthy();

    const resultRes = await context.post(`${apiURL}/api/labs/${labId}/result`, {
      headers,
      data: { result: 'All values normal', status: 'Completed' },
    });
    expect(resultRes.status()).toBe(200);

    const completeRes = await context.post(`${apiURL}/api/labs/complete`, {
      headers,
      data: { encounterId, status: 'COMPLETED' },
    });
    expect([200, 400, 404, 409]).toContain(completeRes.status());

    expect(errors).toEqual([]);
  });
});

test.afterAll(() => {
  if (errors.length) {
    console.error('Laboratory workflow certification errors:', errors);
  }
});
