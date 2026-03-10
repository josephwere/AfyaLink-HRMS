import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app.js";
import setup from "./setupTestEnv.js";
import User from "../models/User.js";
import Hospital from "../models/Hospital.js";
import Patient from "../models/Patient.js";
import Transfer from "../models/Transfer.js";
import TransferConsent from "../models/TransferConsent.js";

let teardown;
let hospitalAdminToken;

beforeAll(async () => {
  teardown = await setup();

  const [fromHospital, toHospital] = await Hospital.create([
    { name: "Source Hospital", code: "SRC-CMD", active: true },
    { name: "Destination Hospital", code: "DST-CMD", active: true },
  ]);

  const admin = await User.create({
    name: "Transfer Admin",
    email: "transfer-admin@afya.test",
    password: "Pass123!",
    role: "HOSPITAL_ADMIN",
    hospital: fromHospital._id,
    active: true,
    emailVerified: true,
  });

  hospitalAdminToken = jwt.sign(
    { id: String(admin._id), twoFactorVerified: true },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
  );

  const patient = await Patient.create({
    firstName: "Jane",
    lastName: "Doe",
    hospital: fromHospital._id,
    nationalId: "TC-1001",
    dob: new Date("1990-01-01"),
    gender: "Female",
  });

  const transfer = await Transfer.create({
    patient: patient._id,
    fromHospital: fromHospital._id,
    toHospital: toHospital._id,
    requestedBy: admin._id,
    status: "Pending",
    reasons: "Higher-level imaging and ICU backup",
    metadata: {
      handoverCompletionScore: 68,
      handoverMissing: ["latest_diagnosis", "clinical_artifacts"],
    },
  });

  await TransferConsent.create({
    transfer: transfer._id,
    patient: patient._id,
    fromHospital: fromHospital._id,
    toHospital: toHospital._id,
    status: "PENDING",
    scopes: ["demographics", "encounters"],
  });
});

afterAll(async () => {
  if (teardown) await teardown();
});

describe("Transfer command center overview", () => {
  test("returns scoped transfer continuity summary", async () => {
    const res = await request(app)
      .get("/api/transfers/command-center/overview")
      .set("Authorization", `Bearer ${hospitalAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.summary.total).toBe(1);
    expect(res.body.summary.pending).toBe(1);
    expect(res.body.summary.consentPending).toBe(1);
    expect(res.body.summary.lowContinuity).toBe(1);

    expect(res.body.items[0].patientName).toBe("Jane Doe");
    expect(res.body.items[0].fromHospitalName).toBe("Source Hospital");
    expect(res.body.items[0].toHospitalName).toBe("Destination Hospital");
    expect(res.body.items[0].handoverCompletionScore).toBe(68);
    expect(res.body.items[0].handoverMissingCount).toBe(2);
    expect(res.body.items[0].consentStatus).toBe("PENDING");
  });
});
