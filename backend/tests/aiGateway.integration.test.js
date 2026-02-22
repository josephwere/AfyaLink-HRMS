import { jest } from "@jest/globals";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import jwt from "jsonwebtoken";
import request from "supertest";

process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "test_jwt_secret";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret";

const redisStore = new Map();
const auditSpy = jest.fn(async () => {});

class MockNeuroEdgeGatewayError extends Error {
  constructor(message, { status = 502, code = "NEUROEDGE_ERROR", details = null } = {}) {
    super(message);
    this.name = "NeuroEdgeGatewayError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const mockClient = {
  authorize: jest.fn(),
  extract: jest.fn(),
  ingestDocument: jest.fn(),
  search: jest.fn(),
  fhirTransform: jest.fn(),
  hl7Transform: jest.fn(),
  staffingForecast: jest.fn(),
  burnoutScore: jest.fn(),
  causalImpact: jest.fn(),
  digitalTwin: jest.fn(),
  getJob: jest.fn(),
  health: jest.fn(),
};

jest.unstable_mockModule("../utils/redis.js", () => ({
  redis: {
    get: jest.fn(async (key) => redisStore.get(key) ?? null),
    set: jest.fn(async (key, value) => {
      redisStore.set(key, value);
      return "OK";
    }),
  },
}));

jest.unstable_mockModule("../services/auditService.js", () => ({
  logAudit: auditSpy,
}));

jest.unstable_mockModule("../services/neuroedgeGatewayClient.js", () => ({
  neuroedgeGatewayClient: mockClient,
  NeuroEdgeGatewayError: MockNeuroEdgeGatewayError,
}));

jest.unstable_mockModule("../jobs/emergencyCleanup.js", () => ({}));
jest.unstable_mockModule("../workers/notificationWorker.js", () => ({}));
jest.unstable_mockModule("../workers/workflowSlaWorker.js", () => ({}));

const { default: app } = await import("../app.js");
const { default: User } = await import("../models/User.js");
const { default: AIGatewayJob } = await import("../models/AIGatewayJob.js");

let mongo;

function tokenFor(user, extra = {}) {
  return jwt.sign(
    {
      id: String(user._id),
      twoFactorVerified: true,
      stepUpVerifiedAt: new Date().toISOString(),
      ...extra,
    },
    process.env.JWT_ACCESS_SECRET
  );
}

async function createUser(role = "SUPER_ADMIN") {
  return User.create({
    name: `${role} User`,
    email: `${String(role).toLowerCase()}_${Date.now()}@afyalink.test`,
    role,
    authProvider: "google",
    active: true,
  });
}

function basePayload() {
  return {
    tenantId: "tenant-a",
    hospitalId: new mongoose.Types.ObjectId().toString(),
    consent: { scopes: ["demographics", "encounters", "labs"] },
  };
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

beforeEach(async () => {
  redisStore.clear();
  auditSpy.mockClear();
  await Promise.all([User.deleteMany({}), AIGatewayJob.deleteMany({})]);

  Object.values(mockClient).forEach((fn) => fn.mockReset());

  mockClient.authorize.mockResolvedValue({ allow: true });
  mockClient.extract.mockResolvedValue({
    status: "SUCCEEDED",
    jobId: "ne_extract_1",
    result: { text: "ok" },
    provenance: {
      model: "neuroedge-med",
      modelVersion: "1.0.0",
      promptHash: "abc",
      evidenceIds: ["e1"],
      generatedAt: new Date().toISOString(),
    },
  });
  mockClient.ingestDocument.mockResolvedValue({
    status: "SUCCEEDED",
    jobId: "ne_ingest_1",
    result: { indexed: true },
    provenance: {
      model: "neuroedge-med",
      modelVersion: "1.0.0",
      promptHash: "abc",
      evidenceIds: ["e1"],
      generatedAt: new Date().toISOString(),
    },
  });
  mockClient.search.mockResolvedValue({
    answers: [{ text: "safe answer", confidence: 0.92, citations: [{ sourceId: "s1" }] }],
    provenance: {
      model: "neuroedge-med",
      modelVersion: "1.0.0",
      promptHash: "p1",
      evidenceIds: ["s1"],
      generatedAt: new Date().toISOString(),
    },
  });
  mockClient.fhirTransform.mockResolvedValue({
    resourceType: "Patient",
    resource: { id: "p1" },
    validation: { valid: true, errors: [] },
    signature: { keyId: "k1", signature: "sig" },
    provenance: {
      model: "neuroedge-interop",
      modelVersion: "1.0.0",
      promptHash: "p2",
      evidenceIds: ["m1"],
      generatedAt: new Date().toISOString(),
    },
  });
  mockClient.hl7Transform.mockResolvedValue({
    messageType: "ORM",
    hl7: "MSH|...",
    validation: { valid: true, errors: [] },
    signature: { keyId: "k1", signature: "sig" },
    provenance: {
      model: "neuroedge-interop",
      modelVersion: "1.0.0",
      promptHash: "p3",
      evidenceIds: ["m2"],
      generatedAt: new Date().toISOString(),
    },
  });
  mockClient.staffingForecast.mockResolvedValue({ shortages: [], confidence: 0.8 });
  mockClient.burnoutScore.mockResolvedValue({ scores: [] });
  mockClient.causalImpact.mockResolvedValue({ estimatedEffects: [] });
  mockClient.digitalTwin.mockResolvedValue({
    status: "SUCCEEDED",
    jobId: "ne_sim_1",
    projections: {},
    recommendations: [],
    confidence: 0.81,
    provenance: {
      model: "neuroedge-sim",
      modelVersion: "1.0.0",
      promptHash: "p4",
      evidenceIds: ["sim1"],
      generatedAt: new Date().toISOString(),
    },
  });
  mockClient.health.mockResolvedValue({ status: "OK" });
  mockClient.getJob.mockResolvedValue({ jobId: "j1", status: "SUCCEEDED" });
});

describe("AI Gateway integration", () => {
  test("401 without token", async () => {
    const res = await request(app)
      .post("/api/ai/gateway/search")
      .send({ ...basePayload(), query: "hello" });

    expect(res.status).toBe(401);
  });

  test("403 for disallowed role", async () => {
    const patient = await createUser("PATIENT");
    const token = tokenFor(patient);

    const res = await request(app)
      .post("/api/ai/gateway/search")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...basePayload(), query: "hello" });

    expect(res.status).toBe(403);
  });

  test("422 validation failure", async () => {
    const admin = await createUser("SUPER_ADMIN");
    const token = tokenFor(admin);

    const res = await request(app)
      .post("/api/ai/gateway/extract")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...basePayload(), source: { uri: "s3://demo" } });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("AI_GATEWAY_VALIDATION_ERROR");
  });

  test("200 on search happy path + correlation header", async () => {
    const admin = await createUser("SUPER_ADMIN");
    const token = tokenFor(admin);

    const res = await request(app)
      .post("/api/ai/gateway/search")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Correlation-Id", "corr-test-1")
      .send({ ...basePayload(), query: "nurse scheduling" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.correlationId).toBe("corr-test-1");
    expect(Array.isArray(res.body.data.answers)).toBe(true);
    expect(res.headers["x-correlation-id"]).toBe("corr-test-1");
  });

  test("202 on extract async and then job status retrievable", async () => {
    const admin = await createUser("SUPER_ADMIN");
    const token = tokenFor(admin);

    const accepted = await request(app)
      .post("/api/ai/gateway/extract")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", "idem-extract-1")
      .send({
        ...basePayload(),
        source: { uri: "s3://scan.pdf", mimeType: "application/pdf" },
      });

    expect(accepted.status).toBe(202);
    const jobId = accepted.body?.data?.jobId;
    expect(jobId).toBeTruthy();

    for (let i = 0; i < 30; i += 1) {
      const job = await AIGatewayJob.findOne({ localJobId: jobId }).lean();
      if (job?.status === "SUCCEEDED") break;
      await new Promise((r) => setTimeout(r, 20));
    }

    const statusRes = await request(app)
      .get(`/api/ai/gateway/jobs/${encodeURIComponent(jobId)}`)
      .set("Authorization", `Bearer ${token}`);

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.ok).toBe(true);
    expect(["RUNNING", "SUCCEEDED", "FAILED"]).toContain(statusRes.body.data.status);
  });

  test("403 when policy decision denies", async () => {
    const admin = await createUser("SUPER_ADMIN");
    const token = tokenFor(admin);
    mockClient.authorize.mockResolvedValueOnce({ allow: false, reason: "CONSENT_POLICY_DENY" });

    const res = await request(app)
      .post("/api/ai/gateway/search")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...basePayload(), query: "sensitive" });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("AI_POLICY_DENIED");
  });

  test("5xx mapped upstream failure", async () => {
    const admin = await createUser("SUPER_ADMIN");
    const token = tokenFor(admin);
    mockClient.search.mockRejectedValueOnce(
      new MockNeuroEdgeGatewayError("timeout", {
        status: 504,
        code: "NEUROEDGE_TIMEOUT",
        details: { retryCount: 2 },
      })
    );

    const res = await request(app)
      .post("/api/ai/gateway/search")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...basePayload(), query: "live trend" });

    expect(res.status).toBe(504);
    expect(res.body.code).toBe("NEUROEDGE_TIMEOUT");
  });

  test("all gateway routes call matching NeuroEdge adapters", async () => {
    const admin = await createUser("SUPER_ADMIN");
    const token = tokenFor(admin);

    const calls = [
      ["post", "/api/ai/gateway/search", { ...basePayload(), query: "q1" }, 200],
      ["post", "/api/ai/gateway/fhir-transform", { ...basePayload(), resourceType: "Patient", payload: { patient: { id: "p1" } } }, 200],
      ["post", "/api/ai/gateway/hl7-transform", { ...basePayload(), messageType: "ORM", payload: { patient: { id: "p1" } } }, 200],
      ["post", "/api/ai/gateway/risk/staffing-forecast", { ...basePayload(), horizonDays: 14 }, 200],
      ["post", "/api/ai/gateway/risk/burnout-score", { ...basePayload(), userIds: [] }, 200],
      ["post", "/api/ai/gateway/risk/causal-impact", { ...basePayload(), policyChange: { rule: "x" } }, 200],
      ["post", "/api/ai/gateway/ingest", { ...basePayload(), document: { uri: "s3://doc.pdf", type: "CLINICAL" } }, 202],
      ["post", "/api/ai/gateway/simulate/digital-twin", { ...basePayload(), scenario: { arrivals: 10 } }, 202],
      ["get", "/api/ai/gateway/health", null, 200],
    ];

    for (const [method, path, body, expected] of calls) {
      const req = request(app)[method](path).set("Authorization", `Bearer ${token}`);
      const res = body ? await req.send(body) : await req;
      expect(res.status).toBe(expected);
    }

    expect(mockClient.search).toHaveBeenCalled();
    expect(mockClient.fhirTransform).toHaveBeenCalled();
    expect(mockClient.hl7Transform).toHaveBeenCalled();
    expect(mockClient.staffingForecast).toHaveBeenCalled();
    expect(mockClient.burnoutScore).toHaveBeenCalled();
    expect(mockClient.causalImpact).toHaveBeenCalled();
    expect(mockClient.ingestDocument).toHaveBeenCalled();
    expect(mockClient.digitalTwin).toHaveBeenCalled();
    expect(mockClient.health).toHaveBeenCalled();
  });
});
