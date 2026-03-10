import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app.js";
import setup from "./setupTestEnv.js";
import User from "../models/User.js";
import Hospital from "../models/Hospital.js";
import Patient from "../models/Patient.js";
import Appointment from "../models/Appointment.js";
import Encounter from "../models/Encounter.js";
import ClinicalDraft from "../models/ClinicalDraft.js";
import Diagnosis from "../models/Diagnosis.js";
import LabOrder from "../models/LabOrder.js";
import Financial from "../models/Financial.js";
import Prescription from "../models/Prescription.js";

let teardown;
let doctorToken;
let patientToken;
let doctorId;
let hospitalId;
let patientId;
let appointmentId;

beforeAll(async () => {
  teardown = await setup();
  const hospital = await Hospital.create({
    name: "Draft Promote Hospital",
    code: "DRAFT-PROMOTE",
    active: true,
    features: { pharmacy: true, payments: true },
  });
  hospitalId = String(hospital._id);

  const doctor = await User.create({
    name: "Draft Doctor",
    email: "draft-doctor@afya.test",
    password: "Pass123!",
    role: "DOCTOR",
    hospital: hospital._id,
    active: true,
    emailVerified: true,
  });
  doctorId = String(doctor._id);

  const patientUser = await User.create({
    name: "Draft Patient",
    email: "draft-patient@afya.test",
    password: "Pass123!",
    role: "PATIENT",
    hospital: hospital._id,
    active: true,
    emailVerified: true,
    phone: "+254700000111",
    nationalIdNumber: "DP-100",
  });

  const patient = await Patient.create({
    firstName: "Draft",
    lastName: "Patient",
    hospital: hospital._id,
    nationalId: "DP-100",
    contact: "+254700000111",
    active: true,
    metadata: { userId: patientUser._id },
  });
  patientId = String(patient._id);

  doctorToken = jwt.sign(
    { id: String(doctor._id), twoFactorVerified: true },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
  );
  patientToken = jwt.sign(
    { id: String(patientUser._id), twoFactorVerified: true },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
  );

  const appt = await request(app)
    .post("/api/appointments")
    .set("Authorization", `Bearer ${doctorToken}`)
    .send({
      patient: patientId,
      hospitalId,
      scheduledAt: new Date().toISOString(),
      serviceType: "General Consultation",
    });

  appointmentId = String(appt.body._id);
});

afterAll(async () => {
  if (teardown) await teardown();
});

test("doctor can promote consultation draft into appointment and encounter then close visit", async () => {
  const saveRes = await request(app)
    .put(`/api/clinical-drafts/OPD_CONSULTATION?patientId=${patientId}`)
    .set("Authorization", `Bearer ${doctorToken}`)
    .send({
      payload: {
        symptoms: "fever,cough",
        assessment: "Needs review",
        diagnosis: "Upper respiratory infection",
        treatmentPlan: "Hydration and medication",
        followUp: "2026-03-16",
      },
    });
  expect(saveRes.status).toBe(200);

  const promoteRes = await request(app)
    .post(`/api/clinical-drafts/OPD_CONSULTATION/promote?patientId=${patientId}&appointmentId=${appointmentId}`)
    .set("Authorization", `Bearer ${doctorToken}`);
  expect(promoteRes.status).toBe(200);
  expect(String(promoteRes.body.appointment._id)).toBe(appointmentId);
  expect(promoteRes.body.appointment.metadata.consultationSummary.diagnosis).toBe("Upper respiratory infection");
  expect(promoteRes.body.encounter.state).toBe("CONSULTING");
  expect(promoteRes.body.encounter.diagnosis).toBe("Upper respiratory infection");

  const handoffRes = await request(app)
    .post(`/api/encounters/${promoteRes.body.encounter._id}/closeout-effects`)
    .set("Authorization", `Bearer ${doctorToken}`)
    .send({
      diagnosis: "Upper respiratory infection",
      diagnosisCode: "J06.9",
      labTests: ["CBC", "Malaria Test"],
    });
  expect(handoffRes.status).toBe(200);
  expect(Array.isArray(handoffRes.body.labOrders)).toBe(true);
  expect(handoffRes.body.labOrders).toHaveLength(2);

  const storedDiagnosis = await Diagnosis.findOne({ encounter: promoteRes.body.encounter._id }).lean();
  expect(storedDiagnosis?.description).toBe("Upper respiratory infection");
  expect(storedDiagnosis?.code).toBe("J06.9");

  const storedLabs = await LabOrder.find({ encounter: promoteRes.body.encounter._id }).lean();
  expect(storedLabs).toHaveLength(2);
  expect(storedLabs.map((row) => row.testName).sort()).toEqual(["CBC", "Malaria Test"]);

  const prematureCloseRes = await request(app)
    .post(`/api/encounters/${promoteRes.body.encounter._id}/close`)
    .set("Authorization", `Bearer ${doctorToken}`);
  expect(prematureCloseRes.status).toBe(409);
  expect(prematureCloseRes.body.code).toBe("CLOSEOUT_REQUIREMENTS_MISSING");
  expect(prematureCloseRes.body.closeout?.missingRequirements).toContain("BILLING");

  const closeRes = await request(app)
    .post(`/api/encounters/${promoteRes.body.encounter._id}/billing-handoff`)
    .set("Authorization", `Bearer ${doctorToken}`)
    .send({
      items: ["Consultation:1000", "Medication Review:500"],
    });
  expect(closeRes.status).toBe(200);
  expect(closeRes.body.invoice.invoiceNumber).toBeDefined();

  const storedInvoice = await Financial.findOne({
    "metadata.encounterId": String(promoteRes.body.encounter._id),
  }).lean();
  expect(storedInvoice?.total).toBe(1500);

  const prescriptionRes = await request(app)
    .post("/api/pharmacy/prescriptions")
    .set("Authorization", `Bearer ${doctorToken}`)
    .send({
      appointmentId,
      meds: [
        {
          name: "Paracetamol",
          dosage: "500mg",
          frequency: "Three times daily",
          duration: "5 days",
        },
      ],
      summary: "Paracetamol for fever control",
      advice: "Take after meals and keep hydrated",
    });
  expect(prescriptionRes.status).toBe(200);

  const storedPrescription = await Prescription.findOne({ appointment: appointmentId }).lean();
  expect(storedPrescription?.summary).toBe("Paracetamol for fever control");

  const finalCloseRes = await request(app)
    .post(`/api/encounters/${promoteRes.body.encounter._id}/close`)
    .set("Authorization", `Bearer ${doctorToken}`);
  expect(finalCloseRes.status).toBe(200);
  expect(finalCloseRes.body.state).toBe("CLOSED");

  const patientEncounterRes = await request(app)
    .get("/api/encounters")
    .set("Authorization", `Bearer ${patientToken}`);
  expect(patientEncounterRes.status).toBe(200);
  expect(Array.isArray(patientEncounterRes.body)).toBe(true);
  const timelineRow = patientEncounterRes.body.find((row) => String(row._id) === String(promoteRes.body.encounter._id));
  expect(timelineRow).toBeTruthy();
  expect(timelineRow.prescriptionSummary?.count).toBe(1);
  expect(timelineRow.prescriptionSummary?.latestStatus).toBe("CREATED");
  expect(timelineRow.prescriptionSummary?.latestSummary).toBe("Paracetamol for fever control");

  const storedDraft = await ClinicalDraft.findOne({ patient: patientId, author: doctorId, draftType: "OPD_CONSULTATION" }).lean();
  expect(String(storedDraft?.payload?._promotion?.appointmentId)).toBe(appointmentId);

  const storedEncounter = await Encounter.findById(promoteRes.body.encounter._id).lean();
  expect(storedEncounter.state).toBe("CLOSED");

  const storedAppointment = await Appointment.findById(appointmentId).lean();
  expect(storedAppointment.metadata.consultationSummary.carePlan).toBe("Hydration and medication");
});

test("hospital closeout override can allow visit close without billing handoff", async () => {
  await Hospital.updateOne(
    { _id: hospitalId },
    {
      $set: {
        "customization.clinical.closeoutPolicy.enabled": true,
        "customization.clinical.closeoutPolicy.requireDiagnosisBeforeClose": true,
        "customization.clinical.closeoutPolicy.requireBillingHandoffWhenPaymentsEnabled": false,
        "customization.clinical.closeoutPolicy.requirePrescriptionWhenPharmacyEnabled": false,
      },
    }
  );

  const appt = await request(app)
    .post("/api/appointments")
    .set("Authorization", `Bearer ${doctorToken}`)
    .send({
      patient: patientId,
      hospitalId,
      scheduledAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      serviceType: "Follow Up Consultation",
    });
  expect(appt.status).toBe(201);

  const appointmentTwoId = String(appt.body._id);

  const saveRes = await request(app)
    .put(`/api/clinical-drafts/OPD_CONSULTATION?patientId=${patientId}`)
    .set("Authorization", `Bearer ${doctorToken}`)
    .send({
      payload: {
        symptoms: "follow-up cough",
        assessment: "Review improving",
        diagnosis: "Viral follow-up",
        treatmentPlan: "Continue supportive care",
        followUp: "2026-03-20",
      },
    });
  expect(saveRes.status).toBe(200);

  const promoteRes = await request(app)
    .post(`/api/clinical-drafts/OPD_CONSULTATION/promote?patientId=${patientId}&appointmentId=${appointmentTwoId}`)
    .set("Authorization", `Bearer ${doctorToken}`);
  expect(promoteRes.status).toBe(200);

  const closeoutRes = await request(app)
    .post(`/api/encounters/${promoteRes.body.encounter._id}/closeout-effects`)
    .set("Authorization", `Bearer ${doctorToken}`)
    .send({
      diagnosis: "Viral follow-up",
      diagnosisCode: "Z09",
      labTests: [],
    });
  expect(closeoutRes.status).toBe(200);

  const closeRes = await request(app)
    .post(`/api/encounters/${promoteRes.body.encounter._id}/close`)
    .set("Authorization", `Bearer ${doctorToken}`);
  expect(closeRes.status).toBe(200);
  expect(closeRes.body.state).toBe("CLOSED");
});
