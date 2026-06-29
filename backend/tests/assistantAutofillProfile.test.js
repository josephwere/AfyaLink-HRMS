import { jest } from "@jest/globals";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import jwt from "jsonwebtoken";
import request from "supertest";

process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "test_jwt_secret";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret";

jest.unstable_mockModule("../utils/redis.js", () => ({
  redis: {
    get: jest.fn(async () => null),
    set: jest.fn(async () => "OK"),
  },
}));

const { default: app } = await import("../app.js");
const { default: User } = await import("../models/User.js");
const { default: AuditLog } = await import("../models/AuditLog.js");

let mongo;

function tokenFor(user) {
  return jwt.sign(
    {
      id: String(user._id),
      twoFactorVerified: true,
    },
    process.env.JWT_ACCESS_SECRET
  );
}

async function createUser(role = "SUPER_ADMIN", metadata = {}) {
  return User.create({
    name: `${role} User`,
    email: `${String(role).toLowerCase()}_${Date.now()}@afyalink.test`,
    role,
    authProvider: "google",
    active: true,
    metadata,
  });
}

describe("Assistant autofill profile + audit", () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create({
      instance: { ip: "127.0.0.1", port: Number(process.env.TEST_MONGO_PORT || 37021) },
    });
    await mongoose.connect(mongo.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
  });

  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), AuditLog.deleteMany({})]);
  });

  test("returns assistant profile per hospital scope from user metadata", async () => {
    const user = await createUser("SUPER_ADMIN", {
      aiAssistantByHospital: {
        "HOSPITAL-ALPHA": {
          notes: "Alpha site note",
          dotPhrases: [{ shortcut: ".claim", content: "Alpha claim wording" }],
          workflowTemplates: [{ workflow: "claims", instructions: "Alpha claims template" }],
          autofillPreferences: { autoApplyHighConfidence: true, confidenceThreshold: 0.9 },
        },
        "HOSPITAL-BETA": {
          notes: "Beta site note",
          dictionaryTerms: [{ term: "sha", replacement: "Social Health Authority" }],
          workflowTemplates: [{ workflow: "referrals", instructions: "Beta handover template" }],
          autofillPreferences: { autoApplyHighConfidence: false, confidenceThreshold: 0.75 },
        },
      },
    });
    const token = tokenFor(user);

    const alpha = await request(app)
      .get("/api/ai/assistant/context")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Hospital", "HOSPITAL-ALPHA")
      .expect(200);

    const beta = await request(app)
      .get("/api/ai/assistant/context")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Hospital", "HOSPITAL-BETA")
      .expect(200);

    expect(alpha.body.context.hospitalScope).toBe("HOSPITAL-ALPHA");
    expect(alpha.body.context.assistantProfile.notes).toBe("Alpha site note");
    expect(alpha.body.context.assistantProfile.dotPhrases[0].shortcut).toBe(".claim");
    expect(alpha.body.context.assistantProfile.workflowTemplates[0].workflow).toBe("claims");
    expect(alpha.body.context.assistantProfile.autofillPreferences.autoApplyHighConfidence).toBe(true);

    expect(beta.body.context.hospitalScope).toBe("HOSPITAL-BETA");
    expect(beta.body.context.assistantProfile.notes).toBe("Beta site note");
    expect(beta.body.context.assistantProfile.dictionaryTerms[0].replacement).toBe("Social Health Authority");
    expect(beta.body.context.assistantProfile.workflowTemplates[0].workflow).toBe("referrals");
    expect(beta.body.context.assistantProfile.autofillPreferences.autoApplyHighConfidence).toBe(false);
  });

  test("writes autofill audit entries with field-level metadata", async () => {
    const user = await createUser();
    const token = tokenFor(user);

    await request(app)
      .post("/api/ai/assistant/autofill-audit")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Hospital", "HOSPITAL-ALPHA")
      .send({
        eventType: "drafted",
        templateId: "claims",
        templateTitle: "Claims Intake",
        route: "/hospital-admin/financials",
        summary: "Drafted 2 fields for review.",
        sourceKinds: ["instruction", "upload"],
        unmatched: ["missing payer phone"],
        items: [
          {
            fieldKey: "text-patient-name",
            fieldLabel: "Patient Name",
            value: "Jane Doe",
            confidence: 0.92,
            evidence: "Patient Name: Jane Doe",
            status: "queued",
          },
        ],
      })
      .expect(200);

    const audit = await AuditLog.findOne({ action: "AI_ASSISTANT_AUTOFILL_DRAFTED" }).lean();
    expect(audit).toBeTruthy();
    expect(audit.after.templateId).toBe("claims");
    expect(audit.metadata.sourceKinds).toEqual(["instruction", "upload"]);
    expect(audit.metadata.items).toHaveLength(1);
    expect(audit.metadata.items[0].fieldLabel).toBe("Patient Name");
    expect(audit.metadata.unmatched).toEqual(["missing payer phone"]);
  });

  test("lists autofill audit entries through ai admin endpoint with hospital filters", async () => {
    const user = await createUser();
    const token = tokenFor(user);

    await request(app)
      .post("/api/ai/assistant/autofill-audit")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Hospital", "HOSPITAL-ALPHA")
      .send({
        eventType: "drafted",
        templateId: "referrals",
        templateTitle: "Referral Workflow",
        route: "/hospital-admin/pharmacy-referrals",
        summary: "Drafted referral fields for review.",
        sourceKinds: ["instruction", "pasted-text"],
        items: [
          {
            fieldKey: "text-referral-reason",
            fieldLabel: "Referral Reason",
            value: "Urgent stock-out",
            confidence: 0.87,
            evidence: "Medication unavailable in hospital stock",
            status: "queued",
          },
        ],
      })
      .expect(200);

    await request(app)
      .post("/api/ai/assistant/autofill-audit")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Hospital", "HOSPITAL-ALPHA")
      .send({
        eventType: "applied",
        templateId: "referrals",
        templateTitle: "Referral Workflow",
        route: "/hospital-admin/pharmacy-referrals",
        summary: "Applied referral fields.",
        sourceKinds: ["instruction"],
        items: [
          {
            fieldKey: "text-referral-reason",
            fieldLabel: "Referral Reason",
            value: "Urgent stock-out",
            confidence: 0.87,
            evidence: "Medication unavailable in hospital stock",
            status: "applied",
          },
        ],
      })
      .expect(200);

    const res = await request(app)
      .get("/api/ai_admin/list?actions=AI_ASSISTANT_AUTOFILL_DRAFTED,AI_ASSISTANT_AUTOFILL_APPLIED&hospitalKey=HOSPITAL-ALPHA")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0].hospitalKey).toBe("HOSPITAL-ALPHA");
    expect(res.body.items[0].metadata.templateTitle).toBe("Referral Workflow");
    expect(res.body.items[0].metadata.items[0].fieldLabel).toBe("Referral Reason");
  });
});
