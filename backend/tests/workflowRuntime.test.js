import setup from "./setupTestEnv.js";
import Hospital from "../models/Hospital.js";
import User from "../models/User.js";
import Patient from "../models/Patient.js";
import Appointment from "../models/Appointment.js";
import Encounter from "../models/Encounter.js";
import Prescription from "../models/Prescription.js";
import { createSchedulingRuntime } from "../scheduling/runtime/schedulingRuntime.js";

let teardown;

beforeAll(async () => {
  teardown = await setup();
});

afterAll(async () => {
  if (teardown) await teardown();
});

test("runtime completes consultation and creates prescriptions in hospital scope", async () => {
  const hospital = await Hospital.create({
    name: "Workflow Runtime Hospital",
    code: "WRH",
    active: true,
  });

  const doctor = await User.create({
    name: "Runtime Doctor",
    email: "runtime-doctor@afya.test",
    password: "Pass123!",
    role: "DOCTOR",
    hospital: hospital._id,
    active: true,
    emailVerified: true,
  });

  const patientRecord = await Patient.create({
    firstName: "Workflow",
    lastName: "Patient",
    hospital: hospital._id,
    nationalId: "WFP-001",
    contact: "+254700000111",
    active: true,
  });

  const appointment = new Appointment({
    patient: patientRecord._id,
    doctor: doctor._id,
    hospital: hospital._id,
    createdBy: doctor._id,
    scheduledAt: new Date(),
    durationMins: 30,
    serviceType: "General Consultation",
    status: "Scheduled",
  });
  appointment.$locals = { viaWorkflow: true };
  await appointment.save();

  const runtime = createSchedulingRuntime({ observability: { emit() {} } });
  const result = await runtime.completeConsultation({
    appointmentId: appointment._id,
    doctorId: doctor._id,
    hospitalId: hospital._id,
    notes: "Follow-up after review",
    diagnosis: "Upper respiratory infection",
    prescriptions: [
      {
        patient: patientRecord._id,
        patientRecord: patientRecord._id,
        doctor: doctor._id,
        hospital: hospital._id,
        medications: [{ name: "Paracetamol", dosage: "500mg", frequency: "TDS", duration: "3 days" }],
        summary: "Pain relief",
        advice: "Take after meals",
      },
    ],
  });

  expect(result.appointment.status).toBe("Completed");
  expect(result.encounter.hospital.toString()).toBe(hospital._id.toString());

  const persistedAppointment = await Appointment.findById(appointment._id).lean();
  expect(persistedAppointment.status).toBe("Completed");
  expect(await Prescription.countDocuments({ hospital: hospital._id })).toBe(1);
  expect(await Encounter.countDocuments({ hospital: hospital._id })).toBe(1);
});
