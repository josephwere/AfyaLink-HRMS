import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import setup from './setupTestEnv.js';
import User from '../models/User.js';
import Hospital from '../models/Hospital.js';

let teardown;
let token;
let adminToken;
let patientId;
let hospitalId;
let doctorUserId;

beforeAll(async ()=>{
  teardown = await setup();
  const hospital = await Hospital.create({ name: "Test Hospital Appointments", active: true });
  hospitalId = String(hospital._id);
  const user = await User.create({
    name: "Doc",
    email: "doc2@afya.test",
    password: "Doc123!",
    role: "DOCTOR",
    hospital: hospital._id,
    active: true,
  });
  doctorUserId = String(user._id);
  const admin = await User.create({
    name: "Hospital Admin",
    email: "admin-appointments@afya.test",
    password: "Admin123!",
    role: "HOSPITAL_ADMIN",
    hospital: hospital._id,
    active: true,
  });
  token = jwt.sign(
    { id: String(user._id), twoFactorVerified: true },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
  );
  adminToken = jwt.sign(
    { id: String(admin._id), twoFactorVerified: true },
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

  test('auto assigns hospital doctor when admin books by hospital and service', async ()=>{
    const r = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        patient: patientId,
        hospitalId,
        scheduledAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        serviceType: 'General Consultation',
      });
    expect([200, 201]).toContain(r.status);
    expect(String(r.body.hospital)).toBe(hospitalId);
    expect(String(r.body.doctor)).toBe(doctorUserId);
    expect(r.body.assignmentStatus).toBe('ASSIGNED');
  });
});
