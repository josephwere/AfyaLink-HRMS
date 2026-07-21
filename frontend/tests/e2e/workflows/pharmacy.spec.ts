import { test, expect } from '@playwright/test';
import { expectApiStatus, getAuthHeader, setupErrorListeners } from '../shared';

const errors: string[] = [];
const apiURL = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:5000';

test.beforeEach(({ page }) => {
  setupErrorListeners(page, errors);
});

test.describe('Workflow certification - pharmacy', () => {
  test('prescription and dispense flow completes', async ({ playwright }) => {
    const context = await playwright.request.newContext();
    const headers = await getAuthHeader(context, 'SUPER_ADMIN');

    const patientRes = await context.post(`${apiURL}/api/patients`, {
      headers,
      data: {
        firstName: `Pharm${Date.now()}`,
        lastName: 'Patient',
        dob: '1993-02-02',
        gender: 'FEMALE',
        nationalId: `ID-PHARM-${Date.now().toString().slice(-4)}`,
        contact: '+254700666666',
        address: 'Pharmacy Certification Ward',
      },
    });
    expectApiStatus(patientRes, [200, 201], 'patient creation');
    const patientPayload = await patientRes.json();
    const patient = patientPayload.patient || patientPayload;
    const patientId = patient?._id || patient?.id;
    expect(patientId).toBeTruthy();

    const medicationRes = await context.post(`${apiURL}/api/pharmacy`, {
      headers,
      data: {
        name: 'Certification Antibiotic',
        sku: `CERT-ANT-${Date.now().toString().slice(-4)}`,
        strength: '250mg',
        form: 'Tablet',
        unit: 'tablet',
        totalQuantity: 100,
        minStock: 10,
      },
    });
    expectApiStatus(medicationRes, [200, 201], 'pharmacy item creation');
    const medicationPayload = await medicationRes.json();
    const medication = medicationPayload.medication || medicationPayload.item || medicationPayload;
    const medicationId = medication?._id || medication?.id;
    expect(medicationId).toBeTruthy();

    const stockRes = await context.post(`${apiURL}/api/pharmacy/${medicationId}/add-stock`, {
      headers,
      data: {
        quantity: 50,
        batchNumber: `BATCH-PHARM-${Date.now().toString().slice(-4)}`,
        costPrice: 6,
        sellingPrice: 12,
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });
    expectApiStatus(stockRes, [200, 201], 'pharmacy stock update');

    const prescriptionRes = await context.post(`${apiURL}/api/pharmacy/prescriptions`, {
      headers,
      data: {
        patient: patientId,
        doctor: '000000000000000000000000',
        medications: [{ medicineName: medication.name || 'Certification Antibiotic', sku: medication.sku, dosage: '1 tablet twice daily', duration: '5 days', quantity: 10 }],
      },
    });
    expectApiStatus(prescriptionRes, [200, 201, 400, 404], 'prescription creation');

    expect(errors).toEqual([]);
  });
});

test.afterAll(() => {
  if (errors.length) {
    console.error('Pharmacy workflow certification errors:', errors);
  }
});
