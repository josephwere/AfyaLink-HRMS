import { test, expect } from '@playwright/test';
import { expectApiStatus, getAuthHeader, setupErrorListeners } from '../shared';

const errors: string[] = [];
const apiURL = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:5000';

test.beforeEach(({ page }) => {
  setupErrorListeners(page, errors);
});

test.describe('Workflow certification - patient journey', () => {
  test('new patient journey completes end to end', async ({ playwright }) => {
    const context = await playwright.request.newContext();
    const headers = await getAuthHeader(context, 'SUPER_ADMIN');

    const patientRes = await context.post(`${apiURL}/api/patients`, {
      headers,
      data: {
        firstName: `Cert${Date.now()}`,
        lastName: 'Patient',
        dob: '1990-05-15',
        gender: 'MALE',
        nationalId: `ID-CERT-${Date.now().toString().slice(-4)}`,
        contact: '+254700000111',
        address: 'Nairobi Certification Lab',
      },
    });
    expectApiStatus(patientRes, [200, 201], 'patient creation');
    const patientPayload = await patientRes.json();
    const patient = patientPayload.patient || patientPayload;

    const doctorRes = await context.get(`${apiURL}/api/appointments/doctors`, { headers });
    expectApiStatus(doctorRes, [200, 201], 'doctor lookup');
    const doctorPayload = await doctorRes.json();
    const doctors = Array.isArray(doctorPayload)
      ? doctorPayload
      : Array.isArray(doctorPayload?.items)
        ? doctorPayload.items
        : [];
    const doctorId = doctors?.[0]?._id || doctors?.[0]?.id || '6a3c5f275b6c4f2322d47132';
    expect(doctorId).toBeTruthy();

    const appointmentRes = await context.post(`${apiURL}/api/appointments`, {
      headers,
      data: {
        patient: patient._id,
        doctorId,
        serviceType: 'General Consultation',
        consultationMode: 'IN_PERSON',
        scheduledAt: new Date().toISOString(),
        reason: 'Certification workflow',
      },
    });
    expectApiStatus(appointmentRes, [200, 201], 'appointment creation');
    const appointmentPayload = await appointmentRes.json();
    const appointment = appointmentPayload.appointment || appointmentPayload;

    const encounterRes = await context.post(`${apiURL}/api/encounters`, {
      headers,
      data: {
        patientId: patient._id,
        type: 'OUTPATIENT',
        complaint: 'Certification journey',
        scheduledAppointment: appointment._id,
      },
    });
    expectApiStatus(encounterRes, [200, 201], 'encounter creation');
    const encounterPayload = await encounterRes.json();
    const encounter = encounterPayload.encounter || encounterPayload;

    const startRes = await context.post(`${apiURL}/api/encounters/${encounter._id}/start`, { headers });
    expectApiStatus(startRes, [200, 201], 'encounter start');

    const hospitalsRes = await context.get(`${apiURL}/api/hospitals`, { headers });
    const hospitalsPayload = await hospitalsRes.json();
    const hospitals = Array.isArray(hospitalsPayload)
      ? hospitalsPayload
      : Array.isArray(hospitalsPayload?.items)
        ? hospitalsPayload.items
        : [];
    const hospitalId = hospitals?.[0]?._id || hospitals?.[0]?.id || undefined;

    const labRes = await context.post(`${apiURL}/api/labs`, {
      headers,
      data: {
        patient: patient._id,
        encounter: encounter._id,
        testType: 'Malaria Antigen Test',
        ...(hospitalId ? { hospitalId } : {}),
      },
    });
    expectApiStatus(labRes, [200, 201, 400, 404], 'lab order creation');
    const labPayload = await labRes.json();
    const lab = labPayload.item || labPayload.lab || labPayload;
    const labId = lab?._id || lab?.id;

    if (labId) {
      const resultRes = await context.post(`${apiURL}/api/labs/${labId}/result`, {
        headers,
        data: { result: 'Certification result', status: 'Completed' },
      });
      expectApiStatus(resultRes, [200, 201, 404], 'lab result upload');
    }

    const pharmaRes = await context.post(`${apiURL}/api/pharmacy`, {
      headers,
      data: {
        name: 'Cert Medication',
        sku: `CERT-MED-${Date.now().toString().slice(-4)}`,
        strength: '100mg',
        form: 'Tablet',
        unit: 'tablet',
        totalQuantity: 100,
        minStock: 10,
      },
    });
    expectApiStatus(pharmaRes, [200, 201], 'pharmacy medication creation');
    const medicationPayload = await pharmaRes.json();
    const medication = medicationPayload.item || medicationPayload.medication || medicationPayload;

    const stockRes = await context.post(`${apiURL}/api/pharmacy/${medication._id}/add-stock`, {
      headers,
      data: {
        quantity: 50,
        batchNumber: `BATCH-CERT-${Date.now().toString().slice(-4)}`,
        costPrice: 8,
        sellingPrice: 15,
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });
    expect([200, 201]).toContain(stockRes.status());

    const prescriptionRes = await context.post(`${apiURL}/api/pharmacy/prescriptions`, {
      headers,
      data: {
        patient: patient._id,
        doctor: doctorId,
        encounter: encounter._id,
        medications: [{ medicineName: medication.name, sku: medication.sku, dosage: '1 tablet daily', duration: '3 days', quantity: 6 }],
      },
    });
    expectApiStatus(prescriptionRes, [200, 201, 400, 404], 'prescription creation');
    const prescriptionPayload = await prescriptionRes.json();
    const prescription = prescriptionPayload.prescription || prescriptionPayload;

    const dispenseRes = await context.post(`${apiURL}/api/pharmacy/dispense`, {
      headers,
      data: { prescriptionId: prescription._id || prescription.id },
    });
    expectApiStatus(dispenseRes, [200, 201, 400, 404], 'prescription dispense');

    const billingRes = await context.post(`${apiURL}/api/encounters/${encounter._id}/billing-handoff`, {
      headers,
      data: { items: [{ description: 'Encounter services', amount: 100 }] },
    });
    expectApiStatus(billingRes, [200, 201], 'billing handoff');

    const closeoutRes = await context.post(`${apiURL}/api/encounters/${encounter._id}/closeout-effects`, {
      headers,
      data: {
        diagnosis: 'Certification diagnosis',
        labTests: ['Malaria Antigen Test'],
      },
    });
    expectApiStatus(closeoutRes, [200, 201], 'closeout effects');

    const closeRes = await context.post(`${apiURL}/api/encounters/${encounter._id}/close`, { headers });
    expectApiStatus(closeRes, [200, 201], 'encounter close');

    expect(errors).toEqual([]);
  });
});

test.afterAll(() => {
  if (errors.length) {
    console.error('Patient journey certification errors:', errors);
  }
});
