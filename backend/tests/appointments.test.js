import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import app from '../app.js';
import setup from './setupTestEnv.js';
import User from '../models/User.js';
import Hospital from '../models/Hospital.js';
import Patient from '../models/Patient.js';
import Appointment from '../models/Appointment.js';
import { normalizeScheduledAtInput } from '../controllers/appointmentController.js';

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

  test('lists hospital appointments for patient self-service bookings', async ()=>{
    const created = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        patient: selfServicePatientId,
        hospitalId,
        scheduledAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
        serviceType: 'General Consultation',
        timeZone: 'Africa/Nairobi',
      });

    expect([200, 201]).toContain(created.status);

    const r = await request(app)
      .get(`/api/appointments/hospital/${hospitalId}`)
      .set('Authorization', `Bearer ${patientToken}`)
      .query({ limit: 10 });

    expect(r.status).toBe(200);
    const items = Array.isArray(r.body) ? r.body : r.body.items;
    expect(Array.isArray(items)).toBe(true);
    expect(items.some((item) => String(item._id) === String(created.body._id))).toBe(true);
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

  test('patient self-service booking ignores submitted doctor and uses hospital scheduling', async ()=>{
    const isolatedUser = await User.create({
      name: 'Service First Patient',
      email: 'service-first-patient@afya.test',
      password: 'Patient123!',
      role: 'PATIENT',
      active: true,
      phone: '+254700000003',
    });
    const isolatedToken = jwt.sign(
      { id: String(isolatedUser._id), twoFactorVerified: true },
      process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
    );
    const isolatedPatient = await Patient.create({
      firstName: 'Service',
      lastName: 'First',
      contact: isolatedUser.phone,
      hospital: hospitalId,
      metadata: { userId: String(isolatedUser._id) },
      active: true,
    });

    const r = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${isolatedToken}`)
      .send({
        patient: String(isolatedPatient._id),
        hospitalId,
        doctor: new mongoose.Types.ObjectId().toString(),
        scheduledAt: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
        serviceType: 'General Consultation',
        timeZone: 'Africa/Nairobi',
      });

    expect([200, 201]).toContain(r.status);
    expect(String(r.body.doctor)).toBe(doctorUserId);
    expect(r.body.assignmentStatus).toBe('ASSIGNED');
  });

  test('doctor busy status pauses assignment and available status assigns queued patients', async ()=>{
    await User.findByIdAndUpdate(doctorUserId, {
      $set: {
        "metadata.doctorWorkStatus": "BUSY_MANUAL",
        "metadata.doctorWorkStatusSource": "MANUAL",
      },
    });

    const queued = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        patient: patientId,
        hospitalId,
        scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        serviceType: 'General Consultation',
      });

    expect([200, 201]).toContain(queued.status);
    expect(queued.body.doctor || null).toBeNull();
    expect(queued.body.assignmentStatus).toBe('PENDING');

    const status = await request(app)
      .patch('/api/appointments/doctors/me/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'AVAILABLE' });

    expect(status.status).toBe(200);
    expect(status.body.status).toBe('AVAILABLE');
    expect(status.body.assignedFromQueue).toBeGreaterThanOrEqual(1);

    const updated = await Appointment.findById(queued.body._id).lean();
    expect(String(updated.doctor)).toBe(doctorUserId);
    expect(updated.assignmentStatus).toBe('ASSIGNED');
  });

  test('reassigns the next queued appointment when a future slot is cancelled', async ()=>{
    await User.findByIdAndUpdate(doctorUserId, {
      $set: {
        "metadata.doctorWorkStatus": "AVAILABLE",
        "metadata.doctorWorkStatusSource": "MANUAL",
      },
    });

    const releasedAt = new Date(Date.now() + 96 * 60 * 60 * 1000);
    const confirmed = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        patient: patientId,
        hospitalId,
        scheduledAt: releasedAt.toISOString(),
        serviceType: 'General Consultation',
      });

    expect([200, 201]).toContain(confirmed.status);
    expect(String(confirmed.body.doctor)).toBe(doctorUserId);
    expect(confirmed.body.assignmentStatus).toBe('ASSIGNED');

    await User.findByIdAndUpdate(doctorUserId, {
      $set: {
        "metadata.doctorWorkStatus": "BUSY_MANUAL",
        "metadata.doctorWorkStatusSource": "MANUAL",
      },
    });

    const queued = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        patient: patientId,
        hospitalId,
        scheduledAt: new Date(Date.now() + 98 * 60 * 60 * 1000).toISOString(),
        serviceType: 'General Consultation',
      });

    expect([200, 201]).toContain(queued.status);
    expect(queued.body.doctor || null).toBeNull();
    expect(queued.body.assignmentStatus).toBe('PENDING');

    await User.findByIdAndUpdate(doctorUserId, {
      $set: {
        "metadata.doctorWorkStatus": "AVAILABLE",
        "metadata.doctorWorkStatusSource": "MANUAL",
      },
    });

    const cancelled = await request(app)
      .delete(`/api/appointments/${confirmed.body._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Patient cancelled' });

    expect(cancelled.status).toBe(200);
    expect(cancelled.body.cancelledAppointment.status).toBe('Cancelled');
    expect(String(cancelled.body.reassignedAppointment?._id)).toBe(String(queued.body._id));

    const queuedAfterCancellation = await Appointment.findById(queued.body._id).lean();
    expect(String(queuedAfterCancellation.doctor)).toBe(doctorUserId);
    expect(queuedAfterCancellation.assignmentStatus).toBe('ASSIGNED');
    expect(new Date(queuedAfterCancellation.scheduledAt).toISOString()).toBe(releasedAt.toISOString());

    const cancelledAfterCancellation = await Appointment.findById(confirmed.body._id).lean();
    expect(cancelledAfterCancellation.status).toBe('Cancelled');
    expect(cancelledAfterCancellation.cancellationReason).toBe('Patient cancelled');
  });

  test('interprets datetime-local values in the requested time zone', ()=>{
    const parsed = normalizeScheduledAtInput('2025-03-10T10:30', 'Africa/Nairobi');
    const expectedUtc = new Date(Date.UTC(2025, 2, 10, 7, 30, 0));
    expect(parsed.getTime()).toBe(expectedUtc.getTime());
  });

  test('blocks patient self-service duplicate booking for the same calendar day', async ()=>{
    const isolatedUser = await User.create({
      name: 'Fresh Portal Patient',
      email: 'fresh-portal-patient@afya.test',
      password: 'Patient123!',
      role: 'PATIENT',
      active: true,
      phone: '+254700000002',
    });
    const isolatedToken = jwt.sign(
      { id: String(isolatedUser._id), twoFactorVerified: true },
      process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
    );
    const isolatedPatient = await Patient.create({
      firstName: 'Fresh',
      lastName: 'Portal Patient',
      contact: isolatedUser.phone,
      hospital: hospitalId,
      metadata: { userId: String(isolatedUser._id) },
      active: true,
    });
    const isolatedPatientId = String(isolatedPatient._id);

    const first = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${isolatedToken}`)
      .send({
        patient: isolatedPatientId,
        hospitalId,
        scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        serviceType: 'General Consultation',
        timeZone: 'Africa/Nairobi',
      });
    expect([200, 201]).toContain(first.status);

    const second = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${isolatedToken}`)
      .send({
        patient: isolatedPatientId,
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
      .set('Authorization', `Bearer ${isolatedToken}`)
      .send({
        patient: isolatedPatientId,
        hospitalId,
        scheduledAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
        serviceType: 'General Consultation',
        timeZone: 'Africa/Nairobi',
      });

    expect([200, 201]).toContain(nextDayBooking.status);
  });
});
