import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app.js";
import setup from "./setupTestEnv.js";
import User from "../models/User.js";
import Hospital from "../models/Hospital.js";
import Patient from "../models/Patient.js";
import Transfer from "../models/Transfer.js";
import OfflineClientMetric from "../models/OfflineClientMetric.js";
import MachineDevice from "../models/MachineDevice.js";
import TrainingTracker from "../models/TrainingTracker.js";
import LeaveRequest from "../models/LeaveRequest.js";
import OvertimeRequest from "../models/OvertimeRequest.js";
import ShiftRequest from "../models/ShiftRequest.js";
import Appointment from "../models/Appointment.js";
import PharmacyItem from "../models/PharmacyItem.js";
import SreIncident from "../models/SreIncident.js";
import Bed from "../models/Bed.js";

let teardown;
let systemAdminToken;

beforeAll(async () => {
  teardown = await setup();

  const systemAdmin = await User.create({
    name: "County Admin",
    email: "county-admin@afya.test",
    password: "Pass123!",
    role: "SYSTEM_ADMIN",
    active: true,
    emailVerified: true,
  });

  systemAdminToken = jwt.sign(
    { id: String(systemAdmin._id), twoFactorVerified: true },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
  );

  const [nairobiHospital, mombasaHospital] = await Hospital.create([
    {
      name: "Nairobi Central",
      code: "NBI-CC-1",
      active: true,
      location: { country: "Kenya", region: "Nairobi", city: "Nairobi" },
    },
    {
      name: "Mombasa General",
      code: "MSA-CC-1",
      active: true,
      location: { country: "Kenya", region: "Mombasa", city: "Mombasa" },
    },
  ]);

  const [doctor, nurse] = await User.create([
    {
      name: "County Doctor",
      email: "doctor-county@afya.test",
      password: "Pass123!",
      role: "DOCTOR",
      hospital: nairobiHospital._id,
      active: true,
      emailVerified: true,
    },
    {
      name: "County Nurse",
      email: "nurse-county@afya.test",
      password: "Pass123!",
      role: "NURSE",
      hospital: nairobiHospital._id,
      active: true,
      emailVerified: true,
    },
  ]);

  const patient = await Patient.create({
    firstName: "County",
    lastName: "Patient",
    nationalId: "COUNTY-1001",
    dob: new Date("1991-01-01"),
    gender: "Female",
    hospital: nairobiHospital._id,
  });

  const appointment = new Appointment({
    patient: patient._id,
    doctor: doctor._id,
    hospital: nairobiHospital._id,
    scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
    status: "Scheduled",
    createdBy: doctor._id,
  });
  appointment.$locals.viaWorkflow = true;
  await appointment.save();

  await Transfer.create({
    patient: patient._id,
    fromHospital: nairobiHospital._id,
    toHospital: mombasaHospital._id,
    requestedBy: doctor._id,
    status: "Pending",
    reasons: "County referral",
    metadata: { handoverCompletionScore: 62 },
  });

  await OfflineClientMetric.create({
    user: doctor._id,
    hospital: nairobiHospital._id,
    role: "DOCTOR",
    deviceId: "county-tablet-1",
    online: false,
    queueLength: 7,
    failedTotal: 2,
  });

  await MachineDevice.create({
    hospital: nairobiHospital._id,
    name: "Lab Analyzer 1",
    code: "LAB-1",
    protocol: "HL7",
    status: "ERROR",
    apiKeyHash: "hash",
  });

  await TrainingTracker.create({
    hospital: nairobiHospital._id,
    traineeName: "County Nurse",
    traineeEmail: "nurse-county@afya.test",
    traineeRole: "NURSE",
    status: "IN_PROGRESS",
    progressPercent: 75,
  });

  await LeaveRequest.create({
    hospital: nairobiHospital._id,
    requester: nurse._id,
    startDate: new Date(),
    endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    status: "PENDING",
  });

  await OvertimeRequest.create({
    hospital: nairobiHospital._id,
    requester: doctor._id,
    hours: 4,
    date: new Date(),
    status: "PENDING",
  });

  await ShiftRequest.create({
    hospital: nairobiHospital._id,
    requester: nurse._id,
    date: new Date(),
    status: "PENDING",
  });

  await PharmacyItem.create({
    hospital: nairobiHospital._id,
    name: "Amoxicillin",
    totalQuantity: 2,
    minStock: 5,
  });

  await SreIncident.create({
    incidentKey: "INC-COUNTY-1",
    hospital: nairobiHospital._id,
    service: "integration-gateway",
    severity: "SEV1",
    status: "OPEN",
    summary: "County integration outage",
    commander: doctor._id,
  });

  await Bed.create([
    { hospital: nairobiHospital._id, ward: "Ward A", number: "1", occupied: true, patient: patient._id },
    { hospital: nairobiHospital._id, ward: "Ward A", number: "2", occupied: false, patient: null },
  ]);
});

afterAll(async () => {
  if (teardown) await teardown();
});

describe("County command center", () => {
  test("returns region-level operational summary", async () => {
    const res = await request(app)
      .get("/api/system-admin/county-command-center")
      .set("Authorization", `Bearer ${systemAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.summary.totalRegions).toBe(2);
    expect(res.body.summary.totalHospitals).toBe(2);
    expect(res.body.summary.pendingApprovals).toBe(3);
    expect(res.body.summary.appointmentsToday).toBe(1);
    expect(res.body.summary.regionsAtRisk).toBe(1);
    expect(res.body.summary.bedState.total).toBe(2);
    expect(res.body.summary.bedState.occupied).toBe(1);
    expect(res.body.summary.stockRisk.lowStockItems).toBe(1);
    expect(res.body.summary.outages.open).toBe(1);

    const nairobi = res.body.regions.find((row) => row.region === "Nairobi");
    expect(nairobi.staff).toBe(2);
    expect(nairobi.doctors).toBe(1);
    expect(nairobi.nurses).toBe(1);
    expect(nairobi.pendingTransfers).toBe(1);
    expect(nairobi.offlineQueue).toBe(7);
    expect(nairobi.offlineFailures).toBe(2);
    expect(nairobi.offlineClientsOffline).toBe(1);
    expect(nairobi.machineError).toBe(1);
    expect(nairobi.totalBeds).toBe(2);
    expect(nairobi.occupiedBeds).toBe(1);
    expect(nairobi.bedOccupancyRate).toBe(50);
    expect(nairobi.lowStockItems).toBe(1);
    expect(nairobi.openOutages).toBe(1);
    expect(nairobi.criticalOutages).toBe(1);
    expect(nairobi.trainingCompletionRate).toBe(75);
    expect(nairobi.appointmentPressure).toBe(1);
  });
});
