import { test, expect } from '@playwright/test';
import { getAuthHeader, setupErrorListeners } from './shared';

const errors: string[] = [];

test.beforeEach(({ page }) => {
  setupErrorListeners(page, errors);
});

test.describe('End-to-End Patient Journey and Emergency Workflows', () => {
  const apiURL = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:5000';

  test('Standard Patient Journey workflow', async ({ playwright }) => {
    const context = await playwright.request.newContext();
    const headers = await getAuthHeader(context, 'SUPER_ADMIN');

    // 1. Patient Registration
    const regRes = await context.post(`${apiURL}/api/patients`, {
      headers,
      data: {
        firstName: 'Journey',
        lastName: 'Patient',
        dob: '1990-05-15',
        gender: 'MALE',
        nationalId: `ID-JRNY-${Date.now().toString().slice(-4)}`,
        contact: '+254700987654',
        address: 'Nairobi central',
      }
    });
    expect(regRes.status()).toBe(201);
    const patientPayload = await regRes.json();
    const patient = patientPayload.patient || patientPayload;
    const patientId = patient._id || patient.id;

    // 2. Appointment Creation
    const docRes = await context.get(`${apiURL}/api/appointments/doctors`, { headers });
    const doctorPayload = await docRes.json();
    const doctors = Array.isArray(doctorPayload)
      ? doctorPayload
      : Array.isArray(doctorPayload?.items)
        ? doctorPayload.items
        : [];
    const doctorId = doctors[0]?._id || doctors[0]?.id;

    const apptRes = await context.post(`${apiURL}/api/appointments`, {
      headers,
      data: {
        patient: patientId,
        doctorId: doctorId,
        serviceType: 'General Consultation',
        consultationMode: 'IN_PERSON',
        scheduledAt: new Date().toISOString(),
        reason: 'Initial consultation and lab checks',
      }
    });
    expect(apptRes.status()).toBe(201);
    const appt = await apptRes.json();

    // 3. Consultation (Encounter started)
    const encRes = await context.post(`${apiURL}/api/encounters`, {
      headers,
      data: {
        patientId,
        type: 'OUTPATIENT',
        complaint: 'Fever and joint pain',
        scheduledAppointment: appt._id,
      }
    });
    expect(encRes.status()).toBe(201);
    const encounter = await encRes.json();
    const encounterId = encounter._id;

    const startEncRes = await context.post(`${apiURL}/api/encounters/${encounterId}/start`, { headers });
    expect(startEncRes.status()).toBe(200);

    // 4. Lab ordered & completed
    const createLabRes = await context.post(`${apiURL}/api/lab`, {
      headers,
      data: {
        patient: patientId,
        encounter: encounterId,
        testType: 'Malaria Antigen Test',
        priority: 'STAT',
      }
    });
    expect(createLabRes.status()).toBe(201);
    const labTest = await createLabRes.json();

    const uploadRes = await context.post(`${apiURL}/api/lab/${labTest._id}/result`, {
      headers,
      data: {
        findings: 'Malaria Falciparum POSITIVE. Parasite density: moderate.',
      }
    });
    expect(uploadRes.status()).toBe(200);

    const completeLabRes = await context.post(`${apiURL}/api/lab/complete`, {
      headers,
      data: {
        labId: labTest._id,
        status: 'COMPLETED',
      }
    });
    expect(completeLabRes.status()).toBe(200);

    // 5. Pharmacy (Prescribed & Dispensed)
    const createDrugRes = await context.post(`${apiURL}/api/pharmacy`, {
      headers,
      data: {
        name: 'Artemether-Lumefantrine (Coartem)',
        sku: `MED-COA-${Date.now().toString().slice(-4)}`,
        strength: '20/120mg',
        form: 'Tablet',
        unit: 'tablet',
        totalQuantity: 100,
        minStock: 10,
      }
    });
    expect(createDrugRes.status()).toBe(201);
    const drug = await createDrugRes.json();

    // Add stock batch
    await context.post(`${apiURL}/api/pharmacy/${drug._id}/add-stock`, {
      headers,
      data: {
        quantity: 50,
        batchNumber: `BATCH-COA-${Date.now().toString().slice(-4)}`,
        costPrice: 8,
        sellingPrice: 15,
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      }
    });

    const presRes = await context.post(`${apiURL}/api/pharmacy/prescriptions`, {
      headers,
      data: {
        patient: patientId,
        doctor: doctorId,
        encounter: encounterId,
        medications: [{
          medicineName: drug.name,
          sku: drug.sku,
          dosage: '2 tablets twice daily',
          duration: '3 days',
          quantity: 12,
        }]
      }
    });
    expect(presRes.status()).toBe(201);
    const prescription = await presRes.json();

    const dispenseRes = await context.post(`${apiURL}/api/pharmacy/dispense`, {
      headers,
      data: {
        prescriptionId: prescription._id,
      }
    });
    expect(dispenseRes.status()).toBe(200);

    // 6. Billing handoff
    const billingRes = await context.post(`${apiURL}/api/encounters/${encounterId}/billing-handoff`, { headers });
    expect(billingRes.status()).toBe(200);

    // 7. Discharge (Close Encounter)
    const closeRes = await context.post(`${apiURL}/api/encounters/${encounterId}/close`, { headers });
    expect(closeRes.status()).toBe(200);
  });

  test('Emergency Workflow simulation', async ({ playwright }) => {
    const context = await playwright.request.newContext();
    const headers = await getAuthHeader(context, 'SUPER_ADMIN');

    // 1. Ambulance Dispatch / Patient creation
    const regRes = await context.post(`${apiURL}/api/patients`, {
      headers,
      data: {
        firstName: 'Emergency',
        lastName: 'Trauma Patient',
        dob: '1985-11-22',
        gender: 'MALE',
        nationalId: `ID-EMRG-${Date.now().toString().slice(-4)}`,
        contact: '+254700911911',
        address: 'Accident Scene Mombasa Road',
      }
    });
    expect(regRes.status()).toBe(201);
    const patientPayload = await regRes.json();
    const patient = patientPayload.patient || patientPayload;
    const patientId = patient._id || patient.id;

    // 2. Admission (Encounter created as EMERGENCY)
    const encRes = await context.post(`${apiURL}/api/encounters`, {
      headers,
      data: {
        patientId,
        type: 'EMERGENCY',
        complaint: 'Multiple fractures and bleeding from road traffic accident',
      }
    });
    expect(encRes.status()).toBe(201);
    const encounterPayload = await encRes.json();
    const encounter = encounterPayload.encounter || encounterPayload;
    const encounterId = encounter._id || encounter.id;

    // 3. Consultation (Encounter started instantly)
    const startEncRes = await context.post(`${apiURL}/api/encounters/${encounterId}/start`, { headers });
    expect(startEncRes.status()).toBe(200);

    // 4. Treatment (Closeout effects / billing handoff setup)
    const closeoutRes = await context.post(`${apiURL}/api/encounters/${encounterId}/closeout-effects`, { headers });
    expect(closeoutRes.status()).toBe(200);

    const billingRes = await context.post(`${apiURL}/api/encounters/${encounterId}/billing-handoff`, { headers });
    expect(billingRes.status()).toBe(200);

    // 5. Discharge (Close Encounter)
    const closeRes = await context.post(`${apiURL}/api/encounters/${encounterId}/close`, { headers });
    expect(closeRes.status()).toBe(200);
  });
});

test.afterAll(() => {
  if (errors.length > 0) {
    console.error('Captured errors during patient journey tests:', errors);
  }
});
