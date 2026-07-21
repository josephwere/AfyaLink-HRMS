import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import setup from './setupTestEnv.js';
import Hospital from '../models/Hospital.js';
import User from '../models/User.js';
import Patient from '../models/Patient.js';
import LabOrder from '../models/LabOrder.js';

let teardown;
let labToken;
let hospitalId;
let patientId;

beforeAll(async () => {
  teardown = await setup();

  const hospital = await Hospital.create({
    name: 'Laboratory Runtime Hospital',
    code: 'LAB-RT',
    active: true,
    features: { pharmacy: true, payments: true },
  });
  hospitalId = String(hospital._id);

  const labTech = await User.create({
    name: 'Lab Tech',
    email: 'lab-tech@afya.test',
    password: 'Pass123!',
    role: 'LAB_TECH',
    hospital: hospital._id,
    active: true,
    emailVerified: true,
  });

  const patient = await Patient.create({
    firstName: 'Lab',
    lastName: 'Patient',
    hospital: hospital._id,
    nationalId: 'LAB-001',
    contact: '+254700001002',
    active: true,
    metadata: { userId: labTech._id },
  });
  patientId = String(patient._id);

  labToken = jwt.sign(
    { id: String(labTech._id), twoFactorVerified: true, hospital: hospitalId, role: 'LAB_TECH' },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
  );
});

afterAll(async () => {
  if (teardown) await teardown();
});

describe('laboratory runtime', () => {
  it('creates and transitions a lab order', async () => {
    const res = await request(app)
      .post('/api/laboratory')
      .set('Authorization', `Bearer ${labToken}`)
      .send({
        patient: patientId,
        hospital: hospitalId,
        testName: 'CBC',
        notes: 'Routine',
      });

    expect(res.status).toBe(201);
    const orderId = res.body.item._id;

    const transitionRes = await request(app)
      .post(`/api/laboratory/${orderId}/transition`)
      .set('Authorization', `Bearer ${labToken}`)
      .send({ to: 'Completed', result: 'Normal', notes: 'Done' });

    expect(transitionRes.status).toBe(200);
    const stored = await LabOrder.findById(orderId).lean();
    expect(stored.status).toBe('Completed');
    expect(stored.result).toBe('Normal');
  });

  it('uploads a lab result for a created lab order', async () => {
    const created = await request(app)
      .post('/api/labs')
      .set('Authorization', `Bearer ${labToken}`)
      .send({
        patient: patientId,
        hospitalId,
        testType: 'Malaria Antigen Test',
        encounter: '000000000000000000000000',
      });

    expect(created.status).toBe(201);
    const orderId = created.body.item._id;

    const resultRes = await request(app)
      .post(`/api/labs/${orderId}/result`)
      .set('Authorization', `Bearer ${labToken}`)
      .send({ result: 'Certification result', status: 'Completed' });

    expect(resultRes.status).toBe(200);
    const stored = await LabOrder.findById(orderId).lean();
    expect(stored.status).toBe('Completed');
    expect(stored.result).toBe('Certification result');
  });
});
