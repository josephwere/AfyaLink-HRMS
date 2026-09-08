import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import app from '../app.js';
import setup from './setupTestEnv.js';
import User from '../models/User.js';
import Hospital from '../models/Hospital.js';
import Patient from '../models/Patient.js';
import Appointment from '../models/Appointment.js';
import workflowService from '../services/workflowService.js';
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

  test('patient cannot approve a consultation mode change directly through the appointment update path', async ()=>{
    const created = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        patient: selfServicePatientId,
        hospitalId,
        scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        serviceType: 'General Consultation',
        consultationMode: 'IN_PERSON',
        timeZone: 'Africa/Nairobi',
      });

    expect([200, 201]).toContain(created.status);
    expect(created.body.consultationMode).toBe('IN_PERSON');

    const updated = await request(app)
      .patch(`/api/appointments/${created.body._id}`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ consultationMode: 'VIDEO' });

    expect(updated.status).toBe(403);
    expect(updated.body.message).toBe('Forbidden by policy');
    expect(updated.body.resource).toBe('appointments');
  });

  test('hospital admin can approve an in-person appointment conversion to video through the workflow update path', async ()=>{
    const created = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        patient: patientId,
        hospitalId,
        scheduledAt: new Date(Date.now() + 16 * 60 * 60 * 1000).toISOString(),
        serviceType: 'General Consultation',
        consultationMode: 'IN_PERSON',
      });

    expect([200, 201]).toContain(created.status);
    expect(created.body.consultationMode).toBe('IN_PERSON');

    const updated = await request(app)
      .patch(`/api/appointments/${created.body._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ consultationMode: 'VIDEO' });

    expect(updated.status).toBe(200);
    expect(updated.body.consultationMode).toBe('VIDEO');
    expect(updated.body.metadata?.consultationModeChangeRequest?.approvalStatus).toBe('APPROVED');
    expect(updated.body.metadata?.consultationModeChangeRequest?.to).toBe('VIDEO');
  });

  test('enforces a single appointment lifecycle transition path through the workflow', async ()=>{
    const created = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        patient: patientId,
        hospitalId,
        scheduledAt: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString(),
        serviceType: 'General Consultation',
      });

    expect([200, 201]).toContain(created.status);

    const checkedIn = await request(app)
      .patch(`/api/appointments/${created.body._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'CheckedIn' });

    expect(checkedIn.status).toBe(200);
    expect(checkedIn.body.status).toBe('CheckedIn');

    const invalidCompletion = await request(app)
      .patch(`/api/appointments/${created.body._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'Completed' });

    expect(invalidCompletion.status).toBe(409);
    expect(invalidCompletion.body.code).toBe('INVALID_APPOINTMENT_TRANSITION');
  });

  test('supports a provider-ready handoff after check-in before consultation starts', async ()=>{
    const created = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        patient: patientId,
        hospitalId,
        scheduledAt: new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString(),
        serviceType: 'General Consultation',
        consultationMode: 'VIDEO',
      });

    expect([200, 201]).toContain(created.status);

    const checkedIn = await request(app)
      .patch(`/api/appointments/${created.body._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'CheckedIn' });

    expect(checkedIn.status).toBe(200);
    expect(checkedIn.body.status).toBe('CheckedIn');

    const providerReady = await request(app)
      .patch(`/api/appointments/${created.body._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'ProviderReady' });

    expect(providerReady.status).toBe(200);
    expect(providerReady.body.status).toBe('ProviderReady');
    expect(providerReady.body.providerReadyAt).toBeDefined();
  });

  test('keeps the action matrix terminal-state safe and role-scoped', async ()=>{
    const scheduled = workflowService.getAllowedActions({ status: 'Scheduled' }, { role: 'RECEPTIONIST' });
    const completed = workflowService.getAllowedActions({ status: 'Completed' }, { role: 'DOCTOR' });
    const cancelled = workflowService.getAllowedActions({ status: 'Cancelled' }, { role: 'RECEPTIONIST' });
    const noShow = workflowService.getAllowedActions({ status: 'NoShow' }, { role: 'DOCTOR' });

    expect(scheduled.canCheckIn).toBe(true);
    expect(scheduled.canCancel).toBe(true);
    expect(completed.canCheckIn).toBe(false);
    expect(completed.canMarkProviderReady).toBe(false);
    expect(completed.canStartConsultation).toBe(false);
    expect(completed.canComplete).toBe(false);
    expect(completed.canCancel).toBe(false);
    expect(cancelled.canCancel).toBe(false);
    expect(noShow.canCancel).toBe(false);
  });

  test('exposes the canonical allowed action matrix and blocks expired appointments', async ()=>{
    const scheduled = workflowService.getAllowedActions({ status: 'Scheduled' }, { role: 'RECEPTIONIST' });
    const checkedIn = workflowService.getAllowedActions({ status: 'CheckedIn' }, { role: 'RECEPTIONIST' });
    const providerReady = workflowService.getAllowedActions({ status: 'ProviderReady' }, { role: 'DOCTOR' });
    const inConsultation = workflowService.getAllowedActions({ status: 'InConsultation' }, { role: 'DOCTOR' });

    expect(scheduled.canCheckIn).toBe(true);
    expect(scheduled.canCancel).toBe(true);
    expect(checkedIn.canMarkProviderReady).toBe(true);
    expect(providerReady.canStartConsultation).toBe(true);
    expect(inConsultation.canComplete).toBe(true);
    expect(workflowService.getAllowedActions({ status: 'Completed' }, { role: 'DOCTOR' }).canComplete).toBe(false);

    const expired = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        patient: patientId,
        hospitalId,
        scheduledAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        serviceType: 'General Consultation',
      });

    expect([200, 201]).toContain(expired.status);
    expect(expired.body.status).toBe('Cancelled');
    expect(expired.body.expiredAt).toBeDefined();
  });

  test('exposes the canonical allowed action matrix for the appointment lifecycle', async ()=>{
    const scheduled = workflowService.getAllowedActions({ status: 'Scheduled' }, { role: 'RECEPTIONIST' });
    const checkedIn = workflowService.getAllowedActions({ status: 'CheckedIn' }, { role: 'RECEPTIONIST' });
    const providerReady = workflowService.getAllowedActions({ status: 'ProviderReady' }, { role: 'DOCTOR' });
    const inConsultation = workflowService.getAllowedActions({ status: 'InConsultation' }, { role: 'DOCTOR' });

    expect(scheduled.canCheckIn).toBe(true);
    expect(scheduled.canCancel).toBe(true);
    expect(checkedIn.canMarkProviderReady).toBe(true);
    expect(providerReady.canStartConsultation).toBe(true);
    expect(inConsultation.canComplete).toBe(true);
    expect(workflowService.getAllowedActions({ status: 'Completed' }, { role: 'DOCTOR' }).canComplete).toBe(false);
  });

  test('accepts richer doctor work statuses and keeps only availability eligible for auto-assignment', async ()=>{
    const consultation = await request(app)
      .patch('/api/appointments/doctors/me/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'IN_CONSULTATION' });

    expect(consultation.status).toBe(200);
    expect(consultation.body.status).toBe('BUSY_AUTOMATIC');
    expect(consultation.body.label).toBe('In Consultation');
    expect(consultation.body.eligibleForAssignment).toBe(false);

    const offDuty = await request(app)
      .patch('/api/appointments/doctors/me/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'OFF_DUTY' });

    expect(offDuty.status).toBe(200);
    expect(offDuty.body.status).toBe('OFF_DUTY');
    expect(offDuty.body.eligibleForAssignment).toBe(false);
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

  test('enforces patient cancellation cutoff from hospital scheduling policy', async ()=>{
    await Hospital.findByIdAndUpdate(hospitalId, {
      $set: {
        "schedulingPolicy.bookingHorizonDays": 30,
        "schedulingPolicy.cancellationCutoffHours": 24,
        "schedulingPolicy.weekendBookingEnabled": true,
        "schedulingPolicy.autoAssignmentEnabled": true,
      },
    });

    const isolatedUser = await User.create({
      name: 'Cancellation Cutoff Patient',
      email: 'cancellation-cutoff-patient@afya.test',
      password: 'Patient123!',
      role: 'PATIENT',
      active: true,
      phone: '+254700000004',
    });
    const isolatedToken = jwt.sign(
      { id: String(isolatedUser._id), twoFactorVerified: true },
      process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
    );
    const isolatedPatient = await Patient.create({
      firstName: 'Cancellation',
      lastName: 'Cutoff',
      contact: isolatedUser.phone,
      hospital: hospitalId,
      metadata: { userId: String(isolatedUser._id) },
      active: true,
    });

    const created = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${isolatedToken}`)
      .send({
        patient: String(isolatedPatient._id),
        hospitalId,
        scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        serviceType: 'General Consultation',
        timeZone: 'Africa/Nairobi',
      });

    expect([200, 201]).toContain(created.status);

    const cancelled = await request(app)
      .delete(`/api/appointments/${created.body._id}`)
      .set('Authorization', `Bearer ${isolatedToken}`)
      .send({ reason: 'Need to reschedule' });

    expect(cancelled.status).toBe(409);
    expect(cancelled.body.code).toBe('CANCELLATION_CUTOFF_ACTIVE');
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

  test('enforces hospital booking horizon policy', async ()=>{
    await Hospital.findByIdAndUpdate(hospitalId, {
      $set: {
        "schedulingPolicy.bookingHorizonDays": 1,
        "schedulingPolicy.weekendBookingEnabled": true,
        "schedulingPolicy.maximumQueueSize": 50,
        "schedulingPolicy.autoAssignmentEnabled": true,
      },
    });

    const r = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        patient: patientId,
        hospitalId,
        scheduledAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
        serviceType: 'General Consultation',
      });

    expect(r.status).toBe(409);
    expect(r.body.code).toBe('BOOKING_HORIZON_EXCEEDED');

    await Hospital.findByIdAndUpdate(hospitalId, {
      $set: {
        "schedulingPolicy.bookingHorizonDays": 30,
      },
    });
  });

  test('enforces hospital queue capacity policy when auto assignment is disabled', async ()=>{
    await Hospital.findByIdAndUpdate(hospitalId, {
      $set: {
        "schedulingPolicy.bookingHorizonDays": 30,
        "schedulingPolicy.weekendBookingEnabled": true,
        "schedulingPolicy.maximumQueueSize": 1,
        "schedulingPolicy.autoAssignmentEnabled": false,
      },
    });

    const first = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        patient: patientId,
        hospitalId,
        scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        serviceType: 'General Consultation',
      });

    expect([200, 201]).toContain(first.status);
    expect(first.body.assignmentStatus).toBe('PENDING');

    const second = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        patient: patientId,
        hospitalId,
        scheduledAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
        serviceType: 'General Consultation',
      });

    expect(second.status).toBe(409);
    expect(second.body.code).toBe('QUEUE_FULL');

    await Hospital.findByIdAndUpdate(hospitalId, {
      $set: {
        "schedulingPolicy.maximumQueueSize": 50,
        "schedulingPolicy.autoAssignmentEnabled": true,
      },
    });
  });
});
