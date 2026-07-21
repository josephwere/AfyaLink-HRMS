import { test, expect } from '@playwright/test';
import { loginAsRole, baseURL, getAuthHeader, setupErrorListeners } from './shared';

const errors: string[] = [];

test.beforeEach(({ page }) => {
  setupErrorListeners(page, errors);
});

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
    await page.locator('select').first().selectOption('Nursing');
    await page.locator('input[placeholder*="password" i]').fill('Test@1234Nurse!');
    await page.locator('select').last().selectOption('nurse');

    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    // Verify success banner/message
    const bodyText = await page.innerText('body');
    expect(bodyText).toContain('registered');
  });

  test('Hospital CRUD via API', async ({ playwright }) => {
    const context = await playwright.request.newContext();
    const headers = await getAuthHeader(context, 'SUPER_ADMIN');

    // 1. Create Hospital
    const createRes = await context.post(`${apiURL}/api/hospitals`, {
      headers,
      data: {
        name: `Automated Test Hospital ${Date.now()}`,
        code: `ATH-${Date.now().toString().slice(-4)}`,
        registrationNumber: `MOH-ATH-${Date.now()}`,
        type: 'PRIVATE',
        country: 'KE',
        region: 'Nairobi',
        city: 'Nairobi',
        address: 'Test Road, Nairobi',
        contact: '+254700123456',
        lat: -1.28,
        lng: 36.82,
      }
    });
    expect(createRes.status()).toBe(201);
    const body = await createRes.json();
    const hospitalId = body.hospital?._id || body._id;
    expect(hospitalId).toBeDefined();

    // 2. Edit/Update Hospital
    const updateRes = await context.put(`${apiURL}/api/hospitals/${hospitalId}`, {
      headers,
      data: {
        name: `Automated Test Hospital Edited ${Date.now()}`,
        address: 'Edited Address, Nairobi',
      }
    });
    expect(updateRes.status()).toBe(200);

    // 3. List/Read Hospitals
    const listRes = await context.get(`${apiURL}/api/hospitals`, { headers });
    expect(listRes.status()).toBe(200);
    const list = await listRes.json();
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
    const ward = await createWardRes.json();
    const wardId = ward._id;

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
    const bed = await createBedRes.json();
    const bedId = bed._id;

    // 3. Update Bed
    const updateBedRes = await context.put(`${apiURL}/api/beds/${bedId}`, {
      headers,
      data: {
        occupied: true,
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
    const patient = await registerRes.json();
    const patientId = patient._id;

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
    const doctors = await docRes.json();
    const doctorId = doctors[0]?._id;

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
    const patient = await regRes.json();
    const patientId = patient._id;

    // 3. Create Appointment
    const createRes = await context.post(`${apiURL}/api/appointments`, {
      headers,
      data: {
        patient: patientId,
        doctorId: doctorId,
        serviceType: 'General Consultation',
        consultationMode: 'IN_PERSON',
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        reason: 'Regular medical checkup',
      }
    });
    expect(createRes.status()).toBe(201);
    const appt = await createRes.json();
    const apptId = appt._id;

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
    const item = await createRes.json();
    const itemId = item._id;

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
    const docRes = await context.get(`${apiURL}/api/appointments/doctors`, { headers });
    const doctors = await docRes.json();
    const doctorId = doctors[0]?._id;

    const patientRes = await context.post(`${apiURL}/api/patients`, {
      headers,
      data: {
        firstName: 'Pharmacy',
        lastName: 'Patient',
        dob: '1990-01-01',
        gender: 'MALE',
        nationalId: `ID-${Date.now().toString().slice(-6)}`,
        contact: '+254733445566',
        address: 'Nairobi',
      }
    });
    const patient = await patientRes.json();
    const patientId = patient._id;

    // Create prescription
    const presRes = await context.post(`${apiURL}/api/pharmacy/prescriptions`, {
      headers,
      data: {
        patient: patientId,
        doctor: doctorId,
        medications: [{
          medicineName: item.name,
          sku: item.sku,
          dosage: '1 daily',
          duration: '5 days',
          quantity: 5,
        }]
      }
    });
    expect(presRes.status()).toBe(201);
    const prescription = await presRes.json();

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
    const patient = await regRes.json();
    const patientId = patient._id;

    // 2. Create Lab Order / Test
    const createLabRes = await context.post(`${apiURL}/api/lab`, {
      headers,
      data: {
        patient: patientId,
        testType: 'Blood Sugar Level',
        priority: 'ROUTINE',
        notes: 'Check blood glucose',
      }
    });
    expect(createLabRes.status()).toBe(201);
    const labTest = await createLabRes.json();
    const labId = labTest._id;

    // 3. Upload Lab Result
    const uploadRes = await context.post(`${apiURL}/api/lab/${labId}/result`, {
      headers,
      data: {
        findings: 'Blood glucose level is 5.8 mmol/L. Normal fasting levels.',
        labTechnicianNotes: 'Normal range confirmed.',
      }
    });
    expect(uploadRes.status()).toBe(200);

    // 4. Complete/Approve Lab Order
    const completeRes = await context.post(`${apiURL}/api/lab/complete`, {
      headers,
      data: {
        labId: labId,
        approvedBy: headers.Authorization,
        status: 'COMPLETED',
      }
    });
    expect(completeRes.status()).toBe(200);
  });
});

test.afterAll(() => {
  if (errors.length > 0) {
    console.error('Captured errors during CRUD tests:', errors);
  }
});
