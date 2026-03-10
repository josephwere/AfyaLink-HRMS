import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app.js";
import setup from "./setupTestEnv.js";
import User from "../models/User.js";
import Hospital from "../models/Hospital.js";
import Connector from "../models/Connector.js";
import Transaction from "../models/Transaction.js";
import InsuranceAuthorization from "../models/InsuranceAuthorization.js";
import PaymentSettings from "../models/PaymentSettings.js";

let teardown;
let systemAdminToken;

beforeAll(async () => {
  teardown = await setup();

  const systemAdmin = await User.create({
    name: "Control Plane Admin",
    email: "control-plane-admin@afya.test",
    password: "Pass123!",
    role: "SYSTEM_ADMIN",
    active: true,
    emailVerified: true,
  });

  systemAdminToken = jwt.sign(
    { id: String(systemAdmin._id), twoFactorVerified: true },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
  );

  const [shaHospital, mpesaHospital] = await Hospital.create([
    {
      name: "SHA Facility",
      code: "SHA-CTRL-1",
      active: true,
      features: { payments: true },
      insuranceProviders: [{ code: "SHA", name: "Social Health Authority", enabled: true }],
      patientPaymentMethods: [{ type: "MPESA", label: "Main Paybill", enabled: true }],
    },
    {
      name: "Payment Facility",
      code: "PAY-CTRL-1",
      active: true,
      features: { payments: true },
      patientPaymentMethods: [{ type: "MPESA", label: "Till", enabled: true }],
    },
  ]);

  await PaymentSettings.create({
    key: "GLOBAL",
    mode: "live",
    mpesa: {
      consumerKey: "consumer-key",
      _enc: "secret-ciphertext",
      shortcode: "123456",
    },
    stripe: {
      publishable: "pk_test",
      _enc: "stripe-ciphertext",
    },
  });

  await Connector.create([
    {
      name: "SHA Production Rail",
      type: "custom",
      profile: "REST",
      url: "https://sha.example.test",
      isActive: true,
      runtime: { mode: "CUTOVER", lastSuccessAt: new Date("2026-03-09T09:00:00.000Z") },
    },
    {
      name: "KRA eTIMS Adapter",
      type: "custom",
      profile: "REST",
      url: "https://etims.example.test",
      isActive: true,
      runtime: { mode: "MIRROR", lastSuccessAt: new Date("2026-03-09T10:00:00.000Z") },
    },
    {
      name: "M-PESA Collections",
      type: "mpesa",
      profile: "REST",
      url: "https://mpesa.example.test",
      isActive: true,
      runtime: { mode: "CUTOVER", lastSuccessAt: new Date("2026-03-09T11:00:00.000Z") },
    },
  ]);

  await Transaction.create([
    { hospital: shaHospital._id, provider: "mpesa", status: "success", amount: 1500 },
    { hospital: mpesaHospital._id, provider: "mpesa", status: "pending", amount: 900 },
    { hospital: mpesaHospital._id, provider: "mpesa", status: "failed", amount: 450 },
  ]);

  await InsuranceAuthorization.create([
    { provider: "SHA", status: "APPROVED", reference: "SHA-OK-1" },
    { provider: "SHA", status: "PENDING", reference: "SHA-PEND-1" },
  ]);
});

afterAll(async () => {
  if (teardown) await teardown();
});

describe("Integration control plane", () => {
  test("returns rollout status for SHA, eTIMS, and M-PESA", async () => {
    const res = await request(app)
      .get("/api/system-admin/integration-control-plane")
      .set("Authorization", `Bearer ${systemAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.summary.paymentEnabledHospitals).toBe(2);
    expect(res.body.summary.shaCoverageHospitals).toBe(1);
    expect(res.body.summary.mpesaCoverageHospitals).toBe(2);

    const sha = res.body.controlPlanes.find((row) => row.key === "SHA");
    const etims = res.body.controlPlanes.find((row) => row.key === "ETIMS");
    const mpesa = res.body.controlPlanes.find((row) => row.key === "MPESA");

    expect(sha.readiness).toBe("READY");
    expect(sha.preauthRequests).toBe(2);
    expect(sha.approvedPreauth).toBe(1);
    expect(Array.isArray(sha.actionPanel)).toBe(true);
    expect(sha.actionPanel[0].label).toBe("Connector runtime");
    expect(etims.readiness).toBe("READY");
    expect(Array.isArray(etims.actionPanel)).toBe(true);
    expect(mpesa.readiness).toBe("READY");
    expect(mpesa.transactions30d).toBe(3);
    expect(mpesa.successfulCollections30d).toBe(1);
    expect(mpesa.failedCollections30d).toBe(1);
    expect(Array.isArray(mpesa.actionPanel)).toBe(true);
    expect(res.body.paymentConfig.mpesaConfigured).toBe(true);
  });
});
