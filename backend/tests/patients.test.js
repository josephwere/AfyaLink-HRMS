import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import setup from './setupTestEnv.js';
import User from '../models/User.js';
import Hospital from '../models/Hospital.js';

let teardown;
let token;

beforeAll(async () => {
  teardown = await setup();
  const hospital = await Hospital.create({ name: "Test Hospital Patients", active: true });
  const user = await User.create({
    name: "Doc",
    email: "doc@afya.test",
    password: "Doc123!",
    role: "DOCTOR",
    hospital: hospital._id,
    active: true,
  });
  token = jwt.sign(
    { id: String(user._id), twoFactorVerified: true },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
  );
});

afterAll(async ()=>{ if (teardown) await teardown(); });

describe('Patients CRUD', ()=>{
  let patientId;
  test('create patient', async ()=>{
    const r = await request(app).post('/api/patients').set('Authorization', `Bearer ${token}`).send({ firstName:'John', lastName:'Doe', nationalId:'P123' });
    expect([200, 201]).toContain(r.status);
    expect(r.body._id).toBeDefined();
    patientId = r.body._id;
  });

  test('get patient', async ()=>{
    const r = await request(app).get(`/api/patients/${patientId}`).set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(200);
    expect(r.body._id).toBe(patientId);
  });
});
