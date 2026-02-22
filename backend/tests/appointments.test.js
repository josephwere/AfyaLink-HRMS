import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import setup from './setupTestEnv.js';
import User from '../models/User.js';
import Hospital from '../models/Hospital.js';

let teardown;
let token;
let patientId;

beforeAll(async ()=>{
  teardown = await setup();
  const hospital = await Hospital.create({ name: "Test Hospital Appointments", active: true });
  const user = await User.create({
    name: "Doc",
    email: "doc2@afya.test",
    password: "Doc123!",
    role: "DOCTOR",
    hospital: hospital._id,
    active: true,
  });
  token = jwt.sign(
    { id: String(user._id), twoFactorVerified: true },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
  );
  const p = await request(app).post('/api/patients').set('Authorization', `Bearer ${token}`).send({ firstName:'Amy', lastName:'Smith' });
  patientId = p.body._id;
});

afterAll(async ()=>{ if (teardown) await teardown(); });

describe('Appointments', ()=>{
  let apptId;
  test('create appointment', async ()=>{
    const r = await request(app).post('/api/appointments').set('Authorization', `Bearer ${token}`).send({ patient: patientId, scheduledAt: new Date().toISOString(), doctor: null });
    expect([200, 201]).toContain(r.status);
    expect(r.body._id).toBeDefined();
    apptId = r.body._id;
  });

  test('list appointments', async ()=>{
    const r = await request(app).get('/api/appointments').set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(200);
    const items = Array.isArray(r.body) ? r.body : r.body.items;
    expect(Array.isArray(items)).toBe(true);
  });
});
