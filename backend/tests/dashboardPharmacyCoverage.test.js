import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app.js";
import setup from "./setupTestEnv.js";
import User from "../models/User.js";
import Hospital from "../models/Hospital.js";
import RegisteredPharmacy from "../models/RegisteredPharmacy.js";
import Notification from "../models/Notification.js";
import { notify } from "../services/notificationService.js";
import Bed from "../models/Bed.js";
import AuditLog from "../models/AuditLog.js";
import Financial from "../models/Financial.js";

let teardown;
let hospitalAdminToken;
let superAdminToken;
let cfoToken;
let hospitalA;

beforeAll(async () => {
  teardown = await setup();

  hospitalA = await Hospital.create({
    name: "Coverage Risk Hospital",
    code: "COVERAGE-RISK-HOSP",
    active: true,
    features: { pharmacy: true },
  });
  const hospitalB = await Hospital.create({
    name: "Linked Coverage Hospital",
    code: "COVERAGE-LINKED-HOSP",
    active: true,
    features: { pharmacy: true },
  });

  const hospitalAdmin = await User.create({
    name: "Coverage Admin",
    email: "coverage-admin@afya.test",
    password: "Pass123!",
    role: "HOSPITAL_ADMIN",
    hospital: hospitalA._id,
    active: true,
  });
  const superAdmin = await User.create({
    name: "Global Coverage Admin",
    email: "global-coverage-admin@afya.test",
    password: "Pass123!",
    role: "SUPER_ADMIN",
    active: true,
    emailVerified: true,
  });
  const cfo = await User.create({
    name: "Executive CFO",
    email: "cfo-exec@afya.test",
    password: "Pass123!",
    role: "CFO",
    hospital: hospitalA._id,
    active: true,
    emailVerified: true,
  });

  const unlinkedPharmacist = await User.create({
    name: "Unlinked Pharmacist",
    email: "unlinked-pharmacist@afya.test",
    password: "Pass123!",
    role: "PHARMACIST",
    hospital: hospitalA._id,
    active: true,
  });

  const linkedPharmacist = await User.create({
    name: "Linked Pharmacist",
    email: "linked-pharmacist@afya.test",
    password: "Pass123!",
    role: "PHARMACIST",
    hospital: hospitalB._id,
    active: true,
  });

  const pharmacy = await RegisteredPharmacy.create({
    name: "Coverage Linked Pharmacy",
    licenseNumber: "COVERAGE-PHARM-001",
    status: "ACTIVE",
    createdBy: superAdmin._id,
    updatedBy: superAdmin._id,
  });

  linkedPharmacist.registeredPharmacy = pharmacy._id;
  await linkedPharmacist.save();

  hospitalAdminToken = jwt.sign(
    { id: String(hospitalAdmin._id), twoFactorVerified: true },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
  );
  superAdminToken = jwt.sign(
    { id: String(superAdmin._id), twoFactorVerified: true },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
  );
  cfoToken = jwt.sign(
    { id: String(cfo._id), twoFactorVerified: true },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
  );

  // keep linter quiet about intentionally created coverage user
  expect(unlinkedPharmacist._id).toBeDefined();

  await notify({
    title: "Pharmacy Coverage Risk",
    body: "Pharmacy is enabled, but no pharmacist is linked to a registered pharmacy yet.",
    category: "PHARMACY",
    user: hospitalAdmin._id,
    hospital: hospitalA._id,
    read: false,
    meta: {
      type: "PHARMACY_COVERAGE_RISK",
      path: "/hospital-admin/staff?missingRegisteredPharmacy=1&q=pharmacist",
    },
  });

  const [bedA, bedB] = await Bed.create([
    { hospital: hospitalA._id, ward: "Ward A", number: "A-01", occupied: false },
    { hospital: hospitalA._id, ward: "Ward B", number: "B-01", occupied: false },
  ]);

  await Financial.create({
    hospital: hospitalA._id,
    invoiceNumber: "INV-EXEC-001",
    total: 2500,
    status: "Paid",
    metadata: { payments: [{ at: new Date() }] },
  });

  await AuditLog.create({
    actorId: hospitalAdmin._id,
    actorRole: "HOSPITAL_ADMIN",
    action: "BED_TRANSFER",
    resource: "Bed",
    resourceId: bedB._id,
    hospital: hospitalA._id,
    metadata: {
      sourceBedId: String(bedA._id),
      targetBedId: String(bedB._id),
      fromWard: "Ward A",
      fromNumber: "A-01",
      toWard: "Ward B",
      toNumber: "B-01",
      patient: "demo-patient",
    },
  });
});

afterAll(async () => {
  if (teardown) await teardown();
});

describe("Dashboard pharmacy coverage warnings", () => {
  test("executive dashboard endpoint returns aggregated command-center metrics", async () => {
    const res = await request(app)
      .get("/api/dashboard/executive")
      .set("Authorization", `Bearer ${hospitalAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.totalStaff).toBeDefined();
    expect(res.body.totalBeds).toBe(2);
    expect(res.body.occupiedBeds).toBe(0);
    expect(res.body.bedOccupancyRate).toBe(0);
    expect(res.body.admissionsToday).toBe(0);
    expect(res.body.dischargesToday).toBe(0);
    expect(res.body.revenueToday).toBe(2500);
    expect(res.body.pendingClaims).toBe(0);
    expect(Array.isArray(res.body.wardOccupancy)).toBe(true);
    expect(res.body.domains).toBeDefined();
    expect(res.body.domains.operations).toBeDefined();
    expect(res.body.domains.pharmacy.risk).toBe(true);
    expect(res.body.domains.pharmacy.pendingPrescriptions).toBe(0);
    expect(res.body.domains.pharmacy.lowStockItems).toBe(0);
    expect(res.body.domains.clinical.pendingLabOrders).toBe(0);
    expect(res.body.domains.clinical.pendingImagingStudies).toBe(0);
    expect(res.body.domains.clinical.completedImagingStudies).toBe(0);
    expect(res.body.domains.clinical.criticalFindingsBacklog).toBe(0);
    expect(res.body.domains.operations.totalBeds).toBe(2);
    expect(res.body.domains.operations.availableBeds).toBe(2);
    expect(res.body.domains.operations.bedOccupancyRate).toBe(0);
    expect(res.body.domains.finance.revenueToday).toBe(2500);
    expect(res.body.domains.finance.outstandingAmount).toBe(0);
    expect(res.body.domains.finance.totalClaims).toBe(0);
    expect(res.body.domains.finance.approvalRate).toBe(0);
  });

  test("CFO can access the executive dashboard contract", async () => {
    const res = await request(app)
      .get("/api/dashboard/executive")
      .set("Authorization", `Bearer ${cfoToken}`);

    expect(res.status).toBe(200);
    expect(res.body.domains).toBeDefined();
    expect(res.body.domains.finance).toBeDefined();
    expect(res.body.domains.finance.revenueToday).toBeDefined();
    expect(res.body.domains.operations).toBeDefined();
  });

  test("hospital admin dashboard exposes pharmacy coverage risk when pharmacists are unlinked", async () => {
    const res = await request(app)
      .get("/api/dashboard/hospital-admin")
      .set("Authorization", `Bearer ${hospitalAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.pharmacyFeatureEnabled).toBe(true);
    expect(res.body.pharmacists).toBe(1);
    expect(res.body.linkedPharmacists).toBe(0);
    expect(res.body.unlinkedPharmacists).toBe(1);
    expect(res.body.unreadPharmacyRiskNotifications).toBe(1);
    expect(res.body.pharmacyCoverageRisk).toBe(true);
    expect(res.body.pharmacyLinkageWarning).toBe(true);
    expect(Array.isArray(res.body.recentBedEvents)).toBe(true);
    expect(res.body.recentBedEvents.length).toBeGreaterThan(0);
    expect(res.body.recentBedEvents[0].action).toBe("BED_TRANSFER");
    expect(res.body.recentBedEvents[0].actor.name).toBe("Coverage Admin");
    expect(res.body.recentBedEvents[0].metadata.sourceBedId).toBeDefined();
  });

  test("super admin dashboard aggregates pharmacist linkage counts", async () => {
    const res = await request(app)
      .get("/api/dashboard/super-admin")
      .set("Authorization", `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.pharmacists).toBe(2);
    expect(res.body.linkedPharmacists).toBe(1);
    expect(res.body.unlinkedPharmacists).toBe(1);
    expect(res.body.hospitalsWithPharmacists).toBe(2);
  });
});
