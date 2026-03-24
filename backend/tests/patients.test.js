import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import setup from './setupTestEnv.js';
import User from '../models/User.js';
import Hospital from '../models/Hospital.js';
import Patient from '../models/Patient.js';
import { buildLinkedMinorSummariesForUser } from '../services/familyMonitoringService.js';

let teardown;
let doctorToken;
let parentToken;
let hospitalId;
let parentUserId;

function isoDateYearsAgo(yearsAgo) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - yearsAgo);
  d.setMonth(5, 15);
  d.setDate(15);
  return d.toISOString().slice(0, 10);
}

beforeAll(async () => {
  teardown = await setup();
  const hospital = await Hospital.create({ name: "Test Hospital Patients", active: true });
  hospitalId = hospital._id;
  const user = await User.create({
    name: "Doc",
    email: "doc@afya.test",
    password: "Doc123!",
    role: "DOCTOR",
    hospital: hospital._id,
    active: true,
  });
  const parent = await User.create({
    name: "Parent Test",
    email: "parent@afya.test",
    password: "Parent123!",
    role: "PATIENT",
    hospital: hospital._id,
    active: true,
    nationalIdNumber: "PARENT-KE-001",
    nationalIdCountry: "KE",
    phone: "+254700000001",
  });
  parentUserId = parent._id;
  doctorToken = jwt.sign(
    { id: String(user._id), twoFactorVerified: true },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
  );
  parentToken = jwt.sign(
    { id: String(parent._id), twoFactorVerified: true },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
  );
});

afterAll(async ()=>{ if (teardown) await teardown(); });

describe('Patients CRUD', ()=>{
  let patientId;
  test('create patient', async ()=>{
    const r = await request(app).post('/api/patients').set('Authorization', `Bearer ${doctorToken}`).send({ firstName:'John', lastName:'Doe', nationalId:'P123' });
    expect([200, 201]).toContain(r.status);
    expect(r.body.patient?._id).toBeDefined();
    patientId = r.body.patient._id;
  });

  test('get patient', async ()=>{
    const r = await request(app).get(`/api/patients/${patientId}`).set('Authorization', `Bearer ${doctorToken}`);
    expect(r.status).toBe(200);
    expect(r.body._id).toBe(patientId);
  });

  test('parent can self-register a minor under their own account', async () => {
    const r = await request(app)
      .post('/api/patients/self-register-minor')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({
        firstName: 'Child',
        lastName: 'SelfRegistered',
        dob: isoDateYearsAgo(10),
        gender: 'FEMALE',
        hospitalId: String(hospitalId),
        relationship: 'PARENT',
        notes: 'Registered by parent through family records',
      });

    expect(r.status).toBe(201);
    expect(r.body.linkedToParent).toBe(true);
    expect(r.body.parentNationalIdNumber).toBe('PARENT-KE-001');
    expect(r.body.patient?._id).toBeDefined();

    const patient = await Patient.findById(r.body.patient._id).lean();
    expect(patient.familyGroup.parentNationalIdNumber).toBe('PARENT-KE-001');
    expect(patient.familyGroup.registrationSource).toBe('SELF_SERVICE');
    expect(patient.guardianLinks.some((link) => String(link.user) === String(parentUserId))).toBe(true);
  });

  test('hospital staff can register a minor using only the parent national ID anchor', async () => {
    const r = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        firstName: 'Child',
        lastName: 'Anchored',
        dob: isoDateYearsAgo(17),
        guardianRelationship: 'PARENT',
        guardianNotes: 'Presented with parent national ID card at triage',
        guardianNationalIdNumber: 'PARENT-KE-001',
        guardianNationalIdCountry: 'KE',
        guardianDisplayName: 'Parent Test',
        guardianPhone: '+254700000001',
      });

    expect(r.status).toBe(201);
    expect(r.body.patient?._id).toBeDefined();

    const patient = await Patient.findById(r.body.patient._id).lean();
    expect(patient.familyGroup.parentNationalIdNumber).toBe('PARENT-KE-001');
    expect(patient.familyGroup.registrationSource).toBe('HOSPITAL_STAFF');

    const summaries = await buildLinkedMinorSummariesForUser(parentUserId);
    const linked = summaries.find((row) => String(row.patientId) === String(r.body.patient._id));
    expect(Boolean(linked)).toBe(true);
    expect(linked.consentPolicy.mode).toBe('SHARED_TEEN_ACCESS');
    expect(linked.consentPolicy.permissions.detailedClinicalNotes).toBe(false);
  });
});
