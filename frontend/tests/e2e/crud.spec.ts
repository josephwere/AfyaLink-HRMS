import { test, expect, type APIRequestContext } from '@playwright/test';
import { createHospitalViaApi, loginAsRole, baseURL, getAuthHeader, setupErrorListeners } from './shared';

const errors: string[] = [];

test.beforeEach(({ page }) => {
  setupErrorListeners(page, errors);
});

function collectionFrom(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.hospitals)) return payload.hospitals;
  return [];
}

function entityFrom(payload: any): any {
  const objectWrapper = (value: any) => value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  return (
    objectWrapper(payload?.patient) ||
    objectWrapper(payload?.hospital) ||
    objectWrapper(payload?.data) ||
    objectWrapper(payload?.item) ||
    objectWrapper(payload?.prescription) ||
    payload
  );
}

function entityId(payload: any): string | undefined {
  const entity = entityFrom(payload);
  return entity?._id || entity?.id || entity?.hospitalId;
}

async function jsonBody(response: any) {
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

async function createPatientFixture(
  context: APIRequestContext,
  apiURL: string,
  headers: Record<string, string>,
  overrides: Record<string, unknown> = {}
) {
  const res = await context.post(`${apiURL}/api/patients`, {
    headers,
    data: {
      firstName: 'Automation',
      lastName: 'Patient',
      dob: '1990-01-01',
      gender: 'MALE',
      nationalId: `ID-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`,
      contact: '+254733445566',
      address: 'Nairobi',
      ...overrides,
    },
  });
  const body = await jsonBody(res);
  expect(res.status(), JSON.stringify(body)).toBe(201);
  const patient = entityFrom(body);
  expect(patient?._id).toBeDefined();
  return patient;
}

async function firstDoctorId(context: APIRequestContext, apiURL: string, headers: Record<string, string>) {
  const docRes = await context.get(`${apiURL}/api/appointments/doctors`, { headers });
  const body = await jsonBody(docRes);
  expect(docRes.status(), JSON.stringify(body)).toBe(200);
  const doctors = collectionFrom(body);
  const doctorId = doctors[0]?._id || doctors[0]?.id;
  expect(doctorId, `No doctor returned from /api/appointments/doctors: ${JSON.stringify(body)}`).toBeDefined();
  return doctorId;
}

async function createAppointmentFixture(
  context: APIRequestContext,
  apiURL: string,
  headers: Record<string, string>,
  patientId: string,
  doctorId?: string,
  daysAhead = 1
) {
  const createPayload = {
    patient: patientId,
    doctor: doctorId,
    hospitalId: headers['X-Hospital-Id'] || headers['X-Hospital'] || undefined,
    serviceType: 'General Consultation',
    consultationMode: 'IN_PERSON',
    scheduledAt: new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString(),
    reason: 'Regular medical checkup',
    timeZone: process.env.DEFAULT_TIME_ZONE || 'Africa/Nairobi',
  };
  const createRes = await context.post(`${apiURL}/api/appointments`, {
    headers,
    data: createPayload,
  });
  const body = await jsonBody(createRes);
  expect([200, 201, 202], JSON.stringify({ createPayload, body })).toContain(createRes.status());
  const appointmentId = entityId(body);
  expect(appointmentId).toBeDefined();
  return { appointment: entityFrom(body), appointmentId };
}

async function patientUserIdFromToken(context: APIRequestContext) {
  const patientHeaders = await getAuthHeader(context, 'PATIENT');
  const token = patientHeaders.Authorization?.replace(/^Bearer\s+/i, '');
  expect(token).toBeTruthy();
  const payload = JSON.parse(Buffer.from(String(token).split('.')[1], 'base64url').toString('utf8'));
  expect(payload?.id).toBeDefined();
  return payload.id as string;
}

test.describe('AfyaLink CRUD validations', () => {
  const apiURL = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:5000';

  test('Staff UI registration flow', async ({ page }) => {
    // Register staff via UI
    await loginAsRole(page, 'SUPER_ADMIN');
    await page.goto(`${baseURL}/app/people/staff/register`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const email = `test.staff.${Date.now()}@afyalink.demo`;
    await page.locator('input[placeholder*="Full name" i]').fill('Test Automation Nurse');
    await page.locator('input[placeholder*="Email address" i]').fill(email);
    await page.locator('select').first().selectOption({ label: 'Emergency' });
    await page.locator('input[placeholder*="password" i]').fill('Test@1234Nurse!');
    await page.locator('select').last().selectOption('nurse');

    const closeTourButton = page.getByRole('button', { name: /close|skip tour/i }).first();
    if (await closeTourButton.isVisible().catch(() => false)) {
      await closeTourButton.click().catch(() => {});
      await page.waitForTimeout(300);
    }

    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    // Verify success banner/message
    await page.waitForTimeout(1000);
    const bodyText = await page.innerText('body');
    expect(bodyText).toMatch(/register|registered|Staff registered|created/i);
  });

  test('Hospital CRUD via API', async ({ playwright }) => {
    const context = await playwright.request.newContext();
    const headers = await getAuthHeader(context, 'SUPER_ADMIN');

    // 1. Create Hospital
    const createRes = await createHospitalViaApi(context, apiURL, headers);
    expect([200, 201, 202, 409]).toContain(createRes.status());
    const bodyText = await createRes.text();
    const body = bodyText ? JSON.parse(bodyText) : {};
    const hospitalId = body.hospital?._id || body.existingHospital?._id || body._id;
    expect(hospitalId).toBeDefined();

    // 2. Edit/Update Hospital when a new registry-backed record was created.
    if (createRes.status() !== 409) {
      const updateRes = await context.put(`${apiURL}/api/hospitals/${hospitalId}`, {
        headers,
        data: {
          name: `Automated Test Hospital Edited ${Date.now()}`,
          address: 'Edited Address, Nairobi',
        }
      });
      expect(updateRes.status()).toBe(200);
    } else {
      expect(body.message).toMatch(/already exists/i);
    }

    // 3. List/Read Hospitals
    const listRes = await context.get(`${apiURL}/api/hospitals`, { headers });
    expect(listRes.status()).toBe(200);
    const list = collectionFrom(await listRes.json());
    expect(list.length).toBeGreaterThan(0);
  });

  test('Wards & Beds CRUD via API', async ({ playwright }) => {
    const context = await playwright.request.newContext();
    const headers = await getAuthHeader(context, 'SUPER_ADMIN');

    // 1. Create Department/Ward (Room/Department representation)
    const createWardRes = await context.post(`${apiURL}/api/beds/wards`, {
      headers,
      data: {
        name: `Test Ward ${Date.now()}`,
        type: 'GENERAL',
        department: 'Outpatient',
        capacity: 10,
      }
    });
    expect(createWardRes.status()).toBe(201);
    const ward = entityFrom(await createWardRes.json());
    const wardId = ward._id;
    expect(wardId).toBeDefined();
    const patient = await createPatientFixture(context, apiURL, headers, {
      firstName: 'Bed',
      lastName: 'Patient',
    });

    // 2. Create Bed in Ward
    const createBedRes = await context.post(`${apiURL}/api/beds`, {
      headers,
      data: {
        ward: ward.name,
        wardRef: wardId,
        number: `B-${Date.now().toString().slice(-4)}`,
      }
    });
    expect(createBedRes.status()).toBe(201);
    const bed = entityFrom(await createBedRes.json());
    const bedId = bed._id;
    expect(bedId).toBeDefined();

    // 3. Update Bed
    const updateBedRes = await context.put(`${apiURL}/api/beds/${bedId}`, {
      headers,
      data: {
        occupied: true,
        patient: patient._id,
      }
    });
    expect(updateBedRes.status()).toBe(200);

    // 4. Discharge/Release Bed
    const dischargeRes = await context.post(`${apiURL}/api/beds/${bedId}/discharge`, { headers });
    expect(dischargeRes.status()).toBe(200);
  });

  test('Patients CRUD via API', async ({ playwright }) => {
    const context = await playwright.request.newContext();
    const headers = await getAuthHeader(context, 'SUPER_ADMIN');

    // 1. Register Patient
    const registerRes = await context.post(`${apiURL}/api/patients`, {
      headers,
      data: {
        firstName: 'Jane',
        lastName: 'Doe',
        dob: '1995-08-20',
        gender: 'FEMALE',
        nationalId: `ID-${Date.now().toString().slice(-6)}`,
        contact: '+254711223344',
        address: 'Nairobi',
      }
    });
    expect(registerRes.status()).toBe(201);
    const patient = entityFrom(await registerRes.json());
    const patientId = patient._id;
    expect(patientId).toBeDefined();

    // 2. Search Patient
    const searchRes = await context.get(`${apiURL}/api/patients/search?query=Jane`, { headers });
    expect(searchRes.status()).toBe(200);
    const searchResult = await searchRes.json();
    expect(searchResult.length).toBeGreaterThan(0);

    // 3. Deactivate Patient (Delete equivalent)
    const deactivateRes = await context.patch(`${apiURL}/api/patients/${patientId}/deactivate`, { headers });
    expect(deactivateRes.status()).toBe(200);
  });

  test('Appointments CRUD via API', async ({ playwright }) => {
    const context = await playwright.request.newContext();
    const headers = await getAuthHeader(context, 'SUPER_ADMIN');

    // 1. Get Doctor for assignment
    const docRes = await context.get(`${apiURL}/api/appointments/doctors`, { headers });
    expect(docRes.status()).toBe(200);
    const doctors = collectionFrom(await docRes.json());
    const doctorId = doctors[0]?._id || doctors[0]?.id;
    expect(doctorId).toBeDefined();

    // 2. Create Patient for appointment
    const regRes = await context.post(`${apiURL}/api/patients`, {
      headers,
      data: {
        firstName: 'John',
        lastName: 'Doe',
        dob: '1988-12-10',
        gender: 'MALE',
        nationalId: `ID-${Date.now().toString().slice(-6)}`,
        contact: '+254722334455',
        address: 'Nairobi',
      }
    });
    const regBody = await jsonBody(regRes);
    expect(regRes.status(), JSON.stringify(regBody)).toBe(201);
    const patient = entityFrom(regBody);
    const patientId = patient._id;
    expect(patientId).toBeDefined();

    // 3. Create Appointment
    const createPayload = {
      patient: patientId,
      doctor: doctorId,
      hospitalId: headers['X-Hospital-Id'] || headers['X-Hospital'] || undefined,
      serviceType: 'General Consultation',
      consultationMode: 'IN_PERSON',
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      reason: 'Regular medical checkup',
      timeZone: process.env.DEFAULT_TIME_ZONE || 'Africa/Nairobi',
    };
    console.log('[appointment-create]', {
      url: `${apiURL}/api/appointments`,
      method: 'POST',
      authHeaderPresent: Boolean(headers.Authorization),
      role: 'SUPER_ADMIN',
      hospitalId: createPayload.hospitalId,
      payload: createPayload,
    });
    const createRes = await context.post(`${apiURL}/api/appointments`, {
      headers,
      data: createPayload,
    });
    const createBodyText = await createRes.text();
    console.log('[appointment-create-response]', {
      status: createRes.status(),
      body: createBodyText,
    });
    expect([200, 201, 202]).toContain(createRes.status());
    const appt = createBodyText ? JSON.parse(createBodyText) : {};
    const apptId = appt._id || appt.appointment?._id;
    expect(apptId).toBeDefined();

    // 4. Update Appointment
    const updateRes = await context.patch(`${apiURL}/api/appointments/${apptId}`, {
      headers,
      data: {
        reason: 'Updated medical checkup reasons',
      }
    });
    expect(updateRes.status()).toBe(200);

    // 5. Cancel/Delete Appointment
    const deleteRes = await context.delete(`${apiURL}/api/appointments/${apptId}`, { headers });
    expect(deleteRes.status()).toBe(200);
  });

  test('Pharmacy inventory and dispense via API', async ({ playwright }) => {
    const context = await playwright.request.newContext();
    const headers = await getAuthHeader(context, 'SUPER_ADMIN');

    // 1. Create pharmacy item
    const createRes = await context.post(`${apiURL}/api/pharmacy`, {
      headers,
      data: {
        name: `Test Drug ${Date.now()}`,
        sku: `SKU-${Date.now().toString().slice(-4)}`,
        strength: '250mg',
        form: 'Tablet',
        unit: 'tablet',
        totalQuantity: 100,
        minStock: 20,
      }
    });
    expect(createRes.status()).toBe(201);
    const item = entityFrom(await createRes.json());
    const itemId = item._id;
    expect(itemId).toBeDefined();

    // 2. Add Stock
    const addRes = await context.post(`${apiURL}/api/pharmacy/${itemId}/add-stock`, {
      headers,
      data: {
        quantity: 50,
        batchNumber: `BATCH-${Date.now().toString().slice(-4)}`,
        costPrice: 5,
        sellingPrice: 10,
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      }
    });
    expect(addRes.status()).toBe(200);

    // 3. Dispense Medication
    // Get a Patient and Doctor to build a Prescription
    const doctorId = await firstDoctorId(context, apiURL, headers);
    const patientUserId = await patientUserIdFromToken(context);
    const patient = await createPatientFixture(context, apiURL, headers, {
      firstName: 'Pharmacy',
      lastName: 'Patient',
      metadata: { userId: patientUserId },
    });
    const patientId = patient._id;
    const { appointmentId } = await createAppointmentFixture(context, apiURL, headers, patientId, doctorId, 2);

    // Create prescription
    const presRes = await context.post(`${apiURL}/api/pharmacy/prescriptions`, {
      headers,
      data: {
        appointmentId,
        meds: [{
          pharmacyItem: itemId,
          name: item.name,
          sku: item.sku,
          unit: item.unit,
          dosage: '1 tablet',
          frequency: 'Once daily',
          duration: '5 days',
          requestedQuantity: 5,
        }]
      }
    });
    expect(presRes.status()).toBe(201);
    const prescription = entityFrom(await presRes.json());

    // Dispense prescription
    const dispenseRes = await context.post(`${apiURL}/api/pharmacy/dispense`, {
      headers,
      data: {
        prescriptionId: prescription._id,
        notes: 'Dispensed successfully by automation script',
      }
    });
    expect(dispenseRes.status()).toBe(200);
  });

  test('Laboratory result creation and approval via API', async ({ playwright }) => {
    const context = await playwright.request.newContext();
    const headers = await getAuthHeader(context, 'SUPER_ADMIN');

    // 1. Create Patient
    const regRes = await context.post(`${apiURL}/api/patients`, {
      headers,
      data: {
        firstName: 'Lab',
        lastName: 'Patient',
        dob: '1992-05-15',
        gender: 'FEMALE',
        nationalId: `ID-${Date.now().toString().slice(-6)}`,
        contact: '+254744556677',
        address: 'Nairobi',
      }
    });
    const regBody = await jsonBody(regRes);
    expect(regRes.status(), JSON.stringify(regBody)).toBe(201);
    const patient = entityFrom(regBody);
    const patientId = patient._id;
    expect(patientId).toBeDefined();

    // 2. Create Lab Order / Test
    const createLabRes = await context.post(`${apiURL}/api/labs`, {
      headers,
      data: {
        patient: patientId,
        testType: 'Blood Sugar Level',
        priority: 'ROUTINE',
        notes: 'Check blood glucose',
      }
    });
    expect(createLabRes.status()).toBe(201);
    const labTest = entityFrom(await createLabRes.json());
    const labId = labTest._id;
    expect(labId).toBeDefined();

    // 3. Upload Lab Result
    const uploadRes = await context.post(`${apiURL}/api/labs/${labId}/result`, {
      headers,
      data: {
        result: 'Blood glucose level is 5.8 mmol/L. Normal fasting levels.',
        labTechnicianNotes: 'Normal range confirmed.',
      }
    });
    expect(uploadRes.status()).toBe(200);
    const completedLab = entityFrom(await uploadRes.json());
    expect(String(completedLab.status || '')).toMatch(/completed/i);
  });
});

test.afterAll(() => {
  if (errors.length > 0) {
    console.error('Captured errors during CRUD tests:', errors);
  }
});
