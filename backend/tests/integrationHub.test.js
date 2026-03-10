import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app.js";
import setup from "./setupTestEnv.js";
import User from "../models/User.js";
import Connector from "../models/Connector.js";
import ConnectorSlaEvent from "../models/ConnectorSlaEvent.js";

let teardown;
let systemAdminToken;

beforeAll(async () => {
  teardown = await setup();

  const systemAdmin = await User.create({
    name: "Integration Admin",
    email: "integration-admin@afya.test",
    password: "Pass123!",
    role: "SYSTEM_ADMIN",
    active: true,
    emailVerified: true,
  });

  systemAdminToken = jwt.sign(
    { id: String(systemAdmin._id), twoFactorVerified: true },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
  );

  const [shaConnector, fhirConnector, mpesaConnector] = await Connector.create([
    {
      name: "SHA National Hub",
      type: "custom",
      profile: "REST",
      url: "https://sha.example.test",
      isActive: true,
      runtime: {
        mode: "MIRROR",
        dryRun: false,
        lastSuccessAt: new Date("2026-03-09T09:00:00.000Z"),
      },
    },
    {
      name: "County FHIR Gateway",
      type: "fhir",
      profile: "FHIR_R4",
      url: "https://fhir.example.test",
      isActive: true,
      runtime: {
        mode: "SHADOW",
        dryRun: true,
        lastSuccessAt: new Date("2026-03-09T08:00:00.000Z"),
        lastErrorAt: new Date("2026-03-09T10:00:00.000Z"),
      },
    },
    {
      name: "M-PESA Collection Rail",
      type: "mpesa",
      profile: "REST",
      url: "https://mpesa.example.test",
      isActive: true,
      runtime: {
        mode: "CUTOVER",
        dryRun: false,
        lastSuccessAt: new Date("2026-03-09T11:00:00.000Z"),
      },
    },
  ]);

  await ConnectorSlaEvent.create([
    {
      connectorId: shaConnector._id,
      connectorType: "CUSTOM",
      operation: "REST_HEALTH",
      ok: true,
      breach: false,
      latencyMs: 240,
      createdAt: new Date("2026-03-09T09:05:00.000Z"),
    },
    {
      connectorId: fhirConnector._id,
      connectorType: "FHIR",
      operation: "FHIR_CAPABILITY",
      ok: false,
      breach: true,
      latencyMs: 920,
      createdAt: new Date("2026-03-09T10:05:00.000Z"),
    },
    {
      connectorId: mpesaConnector._id,
      connectorType: "MPESA",
      operation: "REST_HEALTH",
      ok: true,
      breach: false,
      latencyMs: 300,
      createdAt: new Date("2026-03-09T11:05:00.000Z"),
    },
  ]);
});

afterAll(async () => {
  if (teardown) await teardown();
});

describe("Integration hub summary", () => {
  test("returns required integration modules with derived status", async () => {
    const res = await request(app)
      .get("/api/system-admin/integration-hub")
      .set("Authorization", `Bearer ${systemAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.totals.totalConnectors).toBeGreaterThanOrEqual(3);

    const sha = res.body.modules.find((row) => row.key === "SHA_HIE");
    const fhir = res.body.modules.find((row) => row.key === "FHIR");
    const mpesa = res.body.modules.find((row) => row.key === "MPESA");
    const dicom = res.body.modules.find((row) => row.key === "DICOM");

    expect(sha.status).toBe("READY");
    expect(fhir.status).toBe("DEGRADED");
    expect(mpesa.status).toBe("READY");
    expect(dicom.status).toBe("MISSING");
  });
});
