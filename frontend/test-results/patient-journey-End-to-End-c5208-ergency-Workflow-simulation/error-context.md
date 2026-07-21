# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: patient-journey.spec.ts >> End-to-End Patient Journey and Emergency Workflows >> Emergency Workflow simulation
- Location: tests/e2e/patient-journey.spec.ts:163:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 201
Received: 400
```

# Test source

```ts
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
  151 |     });
  152 |     expect(dispenseRes.status()).toBe(200);
  153 | 
  154 |     // 6. Billing handoff
  155 |     const billingRes = await context.post(`${apiURL}/api/encounters/${encounterId}/billing-handoff`, { headers });
  156 |     expect(billingRes.status()).toBe(200);
  157 | 
  158 |     // 7. Discharge (Close Encounter)
  159 |     const closeRes = await context.post(`${apiURL}/api/encounters/${encounterId}/close`, { headers });
  160 |     expect(closeRes.status()).toBe(200);
  161 |   });
  162 | 
  163 |   test('Emergency Workflow simulation', async ({ playwright }) => {
  164 |     const context = await playwright.request.newContext();
  165 |     const headers = await getAuthHeader(context, 'SUPER_ADMIN');
  166 | 
  167 |     // 1. Ambulance Dispatch / Patient creation
  168 |     const regRes = await context.post(`${apiURL}/api/patients`, {
  169 |       headers,
  170 |       data: {
  171 |         firstName: 'Emergency',
  172 |         lastName: 'Trauma Patient',
  173 |         dob: '1985-11-22',
  174 |         gender: 'MALE',
  175 |         nationalId: `ID-EMRG-${Date.now().toString().slice(-4)}`,
  176 |         contact: '+254700911911',
  177 |         address: 'Accident Scene Mombasa Road',
  178 |       }
  179 |     });
  180 |     expect(regRes.status()).toBe(201);
  181 |     const patient = await regRes.json();
  182 |     const patientId = patient._id;
  183 | 
  184 |     // 2. Admission (Encounter created as EMERGENCY)
  185 |     const encRes = await context.post(`${apiURL}/api/encounters`, {
  186 |       headers,
  187 |       data: {
  188 |         patientId,
  189 |         type: 'EMERGENCY',
  190 |         complaint: 'Multiple fractures and bleeding from road traffic accident',
  191 |       }
  192 |     });
> 193 |     expect(encRes.status()).toBe(201);
      |                             ^ Error: expect(received).toBe(expected) // Object.is equality
  194 |     const encounter = await encRes.json();
  195 |     const encounterId = encounter._id;
  196 | 
  197 |     // 3. Consultation (Encounter started instantly)
  198 |     const startEncRes = await context.post(`${apiURL}/api/encounters/${encounterId}/start`, { headers });
  199 |     expect(startEncRes.status()).toBe(200);
  200 | 
  201 |     // 4. Treatment (Closeout effects / billing handoff setup)
  202 |     const closeoutRes = await context.post(`${apiURL}/api/encounters/${encounterId}/closeout-effects`, { headers });
  203 |     expect(closeoutRes.status()).toBe(200);
  204 | 
  205 |     const billingRes = await context.post(`${apiURL}/api/encounters/${encounterId}/billing-handoff`, { headers });
  206 |     expect(billingRes.status()).toBe(200);
  207 | 
  208 |     // 5. Discharge (Close Encounter)
  209 |     const closeRes = await context.post(`${apiURL}/api/encounters/${encounterId}/close`, { headers });
  210 |     expect(closeRes.status()).toBe(200);
  211 |   });
  212 | });
  213 | 
  214 | test.afterAll(() => {
  215 |   if (errors.length > 0) {
  216 |     console.error('Captured errors during patient journey tests:', errors);
  217 |   }
  218 | });
  219 | 
```