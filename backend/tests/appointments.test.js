import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import app from '../app.js';
import setup from './setupTestEnv.js';
import User from '../models/User.js';
import Hospital from '../models/Hospital.js';
import Patient from '../models/Patient.js';
import Appointment from '../models/Appointment.js';

let teardown;
let token;
let adminToken;
let patientToken;
let patientId;
let selfServicePatientId;
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
  const patientUser = await User.create({
    name: "Patient Portal",
    email: "patient-appointments@afya.test",
    password: "Patient123!",
    role: "PATIENT",
    active: true,
    phone: "+254700000001",
  });
  token = jwt.sign(
    { id: String(user._id), twoFactorVerified: true },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
  );
  adminToken = jwt.sign(
    { id: String(admin._id), twoFactorVerified: true },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
  );
  patientToken = jwt.sign(
    { id: String(patientUser._id), twoFactorVerified: true },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
  );
  const p = await request(app).post('/api/patients').set('Authorization', `Bearer ${token}`).send({ firstName:'Amy', lastName:'Smith' });
  patientId = p.body.patient?._id;
  expect(patientId).toBeDefined();
  const portalPatient = await Patient.create({
    firstName: "Portal",
    lastName: "Patient",
    contact: patientUser.phone,
    hospital: hospital._id,
    metadata: { userId: String(patientUser._id) },
    active: true,
  });
  selfServicePatientId = String(portalPatient._id);
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

  test('blocks patient self-service duplicate booking for the same calendar day', async ()=>{
    const first = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        patient: selfServicePatientId,
        hospitalId,
        scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        serviceType: 'General Consultation',
        timeZone: 'Africa/Nairobi',
      });
    expect([200, 201]).toContain(first.status);

    const second = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        patient: selfServicePatientId,
        hospitalId,
        scheduledAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
        serviceType: 'General Consultation',
        timeZone: 'Africa/Nairobi',
      });

    expect(second.status).toBe(409);
    expect(second.body.code).toBe('APPOINTMENT_DAILY_LIMIT');
    expect(second.body.nextAvailableAt).toBeDefined();
    expect(second.body.existingAppointment?._id).toBeDefined();

    const moved = await Appointment.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(first.body._id) },
      { $set: { createdAt: new Date("2020-01-01T08:00:00.000Z") } }
    );
    expect(moved.modifiedCount).toBe(1);

    const nextDayBooking = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        patient: selfServicePatientId,
        hospitalId,
        scheduledAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
        serviceType: 'General Consultation',
        timeZone: 'Africa/Nairobi',
      });

    expect([200, 201]).toContain(nextDayBooking.status);
  });
});
