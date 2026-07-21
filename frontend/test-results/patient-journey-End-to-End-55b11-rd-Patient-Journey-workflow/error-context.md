# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: patient-journey.spec.ts >> End-to-End Patient Journey and Emergency Workflows >> Standard Patient Journey workflow
- Location: tests/e2e/patient-journey.spec.ts:13:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 201
Received: 400
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import { getAuthHeader, setupErrorListeners } from './shared';
  3   | 
  4   | const errors: string[] = [];
  5   | 
  6   | test.beforeEach(({ page }) => {
  7   |   setupErrorListeners(page, errors);
  8   | });
  9   | 
  10  | test.describe('End-to-End Patient Journey and Emergency Workflows', () => {
  11  |   const apiURL = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:5000';
  12  | 
  13  |   test('Standard Patient Journey workflow', async ({ playwright }) => {
  14  |     const context = await playwright.request.newContext();
  15  |     const headers = await getAuthHeader(context, 'SUPER_ADMIN');
  16  | 
  17  |     // 1. Patient Registration
  18  |     const regRes = await context.post(`${apiURL}/api/patients`, {
  19  |       headers,
  20  |       data: {
  21  |         firstName: 'Journey',
  22  |         lastName: 'Patient',
  23  |         dob: '1990-05-15',
  24  |         gender: 'MALE',
  25  |         nationalId: `ID-JRNY-${Date.now().toString().slice(-4)}`,
  26  |         contact: '+254700987654',
  27  |         address: 'Nairobi central',
  28  |       }
  29  |     });
  30  |     expect(regRes.status()).toBe(201);
  31  |     const patient = await regRes.json();
  32  |     const patientId = patient._id;
  33  | 
  34  |     // 2. Appointment Creation
  35  |     const docRes = await context.get(`${apiURL}/api/appointments/doctors`, { headers });
  36  |     const doctors = await docRes.json();
  37  |     const doctorId = doctors[0]?._id;
  38  | 
  39  |     const apptRes = await context.post(`${apiURL}/api/appointments`, {
  40  |       headers,
  41  |       data: {
  42  |         patient: patientId,
  43  |         doctorId: doctorId,
  44  |         serviceType: 'General Consultation',
  45  |         consultationMode: 'IN_PERSON',
  46  |         scheduledAt: new Date().toISOString(),
  47  |         reason: 'Initial consultation and lab checks',
  48  |       }
  49  |     });
> 50  |     expect(apptRes.status()).toBe(201);
      |                              ^ Error: expect(received).toBe(expected) // Object.is equality
  51  |     const appt = await apptRes.json();
  52  | 
  53  |     // 3. Consultation (Encounter started)
  54  |     const encRes = await context.post(`${apiURL}/api/encounters`, {
  55  |       headers,
  56  |       data: {
  57  |         patientId,
  58  |         type: 'OUTPATIENT',
  59  |         complaint: 'Fever and joint pain',
  60  |         scheduledAppointment: appt._id,
  61  |       }
  62  |     });
  63  |     expect(encRes.status()).toBe(201);
  64  |     const encounter = await encRes.json();
  65  |     const encounterId = encounter._id;
  66  | 
  67  |     const startEncRes = await context.post(`${apiURL}/api/encounters/${encounterId}/start`, { headers });
  68  |     expect(startEncRes.status()).toBe(200);
  69  | 
  70  |     // 4. Lab ordered & completed
  71  |     const createLabRes = await context.post(`${apiURL}/api/lab`, {
  72  |       headers,
  73  |       data: {
  74  |         patient: patientId,
  75  |         encounter: encounterId,
  76  |         testType: 'Malaria Antigen Test',
  77  |         priority: 'STAT',
  78  |       }
  79  |     });
  80  |     expect(createLabRes.status()).toBe(201);
  81  |     const labTest = await createLabRes.json();
  82  | 
  83  |     const uploadRes = await context.post(`${apiURL}/api/lab/${labTest._id}/result`, {
  84  |       headers,
  85  |       data: {
  86  |         findings: 'Malaria Falciparum POSITIVE. Parasite density: moderate.',
  87  |       }
  88  |     });
  89  |     expect(uploadRes.status()).toBe(200);
  90  | 
  91  |     const completeLabRes = await context.post(`${apiURL}/api/lab/complete`, {
  92  |       headers,
  93  |       data: {
  94  |         labId: labTest._id,
  95  |         status: 'COMPLETED',
  96  |       }
  97  |     });
  98  |     expect(completeLabRes.status()).toBe(200);
  99  | 
  100 |     // 5. Pharmacy (Prescribed & Dispensed)
  101 |     const createDrugRes = await context.post(`${apiURL}/api/pharmacy`, {
  102 |       headers,
  103 |       data: {
  104 |         name: 'Artemether-Lumefantrine (Coartem)',
  105 |         sku: `MED-COA-${Date.now().toString().slice(-4)}`,
  106 |         strength: '20/120mg',
  107 |         form: 'Tablet',
  108 |         unit: 'tablet',
  109 |         totalQuantity: 100,
  110 |         minStock: 10,
  111 |       }
  112 |     });
  113 |     expect(createDrugRes.status()).toBe(201);
  114 |     const drug = await createDrugRes.json();
  115 | 
  116 |     // Add stock batch
  117 |     await context.post(`${apiURL}/api/pharmacy/${drug._id}/add-stock`, {
  118 |       headers,
  119 |       data: {
  120 |         quantity: 50,
  121 |         batchNumber: `BATCH-COA-${Date.now().toString().slice(-4)}`,
  122 |         costPrice: 8,
  123 |         sellingPrice: 15,
  124 |         expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  125 |       }
  126 |     });
  127 | 
  128 |     const presRes = await context.post(`${apiURL}/api/pharmacy/prescriptions`, {
  129 |       headers,
  130 |       data: {
  131 |         patient: patientId,
  132 |         doctor: doctorId,
  133 |         encounter: encounterId,
  134 |         medications: [{
  135 |           medicineName: drug.name,
  136 |           sku: drug.sku,
  137 |           dosage: '2 tablets twice daily',
  138 |           duration: '3 days',
  139 |           quantity: 12,
  140 |         }]
  141 |       }
  142 |     });
  143 |     expect(presRes.status()).toBe(201);
  144 |     const prescription = await presRes.json();
  145 | 
  146 |     const dispenseRes = await context.post(`${apiURL}/api/pharmacy/dispense`, {
  147 |       headers,
  148 |       data: {
  149 |         prescriptionId: prescription._id,
  150 |       }
```