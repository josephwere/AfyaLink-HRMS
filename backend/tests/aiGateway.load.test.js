import { jest } from "@jest/globals";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import jwt from "jsonwebtoken";
import request from "supertest";

process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "test_jwt_secret";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret";

const redisStore = new Map();

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
  logAudit: jest.fn(async () => {}),
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
let token;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());

  const admin = await User.create({
    name: "Gateway Load Admin",
    email: `load_admin_${Date.now()}@afyalink.test`,
    role: "SUPER_ADMIN",
    authProvider: "google",
    active: true,
  });
  token = jwt.sign(
    {
      id: String(admin._id),
      twoFactorVerified: true,
      stepUpVerifiedAt: new Date().toISOString(),
    },
    process.env.JWT_ACCESS_SECRET
  );
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

beforeEach(async () => {
  redisStore.clear();
  await AIGatewayJob.deleteMany({});
  Object.values(mockClient).forEach((fn) => fn.mockReset());

  mockClient.authorize.mockResolvedValue({ allow: true });
  mockClient.extract.mockResolvedValue({
    status: "SUCCEEDED",
    jobId: "ne_load_extract",
    result: { text: "ok" },
    provenance: {
      model: "neuroedge-med",
      modelVersion: "1.0.0",
      promptHash: "load-hash",
      evidenceIds: ["e-load"],
      generatedAt: new Date().toISOString(),
    },
  });
});

describe("AI Gateway load sanity", () => {
  test("concurrent idempotent async requests are stable", async () => {
    const concurrency = 24;
    const idempotencyKey = "idem-load-1";
    const payload = {
      tenantId: "tenant-load",
      hospitalId: new mongoose.Types.ObjectId().toString(),
      source: { uri: "s3://bulk.pdf", mimeType: "application/pdf" },
      consent: { scopes: ["demographics", "labs"] },
    };

    const startedAt = Date.now();
    const responses = await Promise.all(
      Array.from({ length: concurrency }, () =>
        request(app)
          .post("/api/ai/gateway/extract")
          .set("Authorization", `Bearer ${token}`)
          .set("Idempotency-Key", idempotencyKey)
          .send(payload)
      )
    );
    const elapsedMs = Date.now() - startedAt;

    responses.forEach((res) => {
      expect([200, 202]).toContain(res.status);
      expect(res.body.ok).toBe(true);
      expect(res.body.data?.jobId).toBeTruthy();
    });

    const uniqueJobIds = new Set(responses.map((r) => r.body?.data?.jobId));
    expect(uniqueJobIds.size).toBe(1);

    const jobs = await AIGatewayJob.find({ endpoint: "extract", idempotencyKey }).lean();
    expect(jobs.length).toBeGreaterThan(0);

    const targetJobId = responses[0].body.data.jobId;
    const statusRes = await request(app)
      .get(`/api/ai/gateway/jobs/${encodeURIComponent(targetJobId)}`)
      .set("Authorization", `Bearer ${token}`);

    expect(statusRes.status).toBe(200);
    expect(["RUNNING", "SUCCEEDED", "FAILED"]).toContain(statusRes.body.data.status);

    // Keep this as sanity (not strict perf benchmark) to catch pathological regressions.
    expect(elapsedMs).toBeLessThan(5000);
  });
});
