import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import setup from './setupTestEnv.js';
import Hospital from '../models/Hospital.js';
import User from '../models/User.js';
import Patient from '../models/Patient.js';
import RadiologyStudy from '../models/RadiologyStudy.js';

let teardown;
let radiologyToken;
let hospitalId;
let patientId;

beforeAll(async () => {
  teardown = await setup();

  const hospital = await Hospital.create({
    name: 'Radiology Runtime Hospital',
    code: 'RAD-RT',
    active: true,
    features: { pharmacy: true, payments: true },
  });
  hospitalId = String(hospital._id);

  const radiologyTech = await User.create({
    name: 'Radiology Tech',
    email: 'radiology-tech@afya.test',
    password: 'Pass123!',
    role: 'LAB_TECH',
    hospital: hospital._id,
    active: true,
    emailVerified: true,
  });

  const patient = await Patient.create({
    firstName: 'Radio',
    lastName: 'Patient',
    hospital: hospital._id,
    nationalId: 'RAD-001',
    contact: '+254700001003',
    active: true,
    metadata: { userId: radiologyTech._id },
  });
  patientId = String(patient._id);

  radiologyToken = jwt.sign(
    { id: String(radiologyTech._id), twoFactorVerified: true, hospital: hospitalId, role: 'LAB_TECH' },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
  );
});

afterAll(async () => {
  if (teardown) await teardown();
});

describe('radiology runtime', () => {
  it('creates and transitions a radiology study', async () => {
    const res = await request(app)
      .post('/api/radiology')
      .set('Authorization', `Bearer ${radiologyToken}`)
      .send({
        patient: patientId,
        hospital: hospitalId,
        studyType: 'CT BRAIN',
        notes: 'Urgent',
      });

    expect(res.status).toBe(201);
    const studyId = res.body.item._id;

    const transitionRes = await request(app)
      .post(`/api/radiology/${studyId}/transition`)
      .set('Authorization', `Bearer ${radiologyToken}`)
      .send({ to: 'Completed', result: 'No acute findings', notes: 'Done' });

    expect(transitionRes.status).toBe(200);
    const stored = await RadiologyStudy.findById(studyId).lean();
    expect(stored.status).toBe('Completed');
    expect(stored.result).toBe('No acute findings');
  });
});
