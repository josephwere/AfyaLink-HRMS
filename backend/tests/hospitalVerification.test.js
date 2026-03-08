import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app.js";
import setup from "./setupTestEnv.js";
import User from "../models/User.js";
import Hospital from "../models/Hospital.js";
import GovernmentHospitalRegistry from "../models/GovernmentHospitalRegistry.js";

let teardown;
let superAdminToken;

function fakePdfBuffer(label) {
  const prefix = Buffer.from(`%PDF-1.4\n${label}\n`, "utf8");
  const filler = Buffer.alloc(24 * 1024, "A");
  const suffix = Buffer.from("\n%%EOF", "utf8");
  return Buffer.concat([prefix, filler, suffix]);
}

beforeAll(async () => {
  teardown = await setup();
  const superAdmin = await User.create({
    name: "Root Admin",
    email: "root-hospital-verify@afya.test",
    password: "Admin123!",
    role: "SUPER_ADMIN",
    active: true,
    twoFactorEnabled: true,
  });
  superAdminToken = jwt.sign(
    { id: String(superAdmin._id), twoFactorVerified: true },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
  );
});

afterAll(async () => {
  if (teardown) await teardown();
});

describe("Hospital verification workflow", () => {
  test("blocks hospital creation when registration number is not in approved registry", async () => {
    const res = await request(app)
      .post("/api/hospitals")
      .set("Authorization", `Bearer ${superAdminToken}`)
      .field("name", "Unknown Clinic")
      .field("type", "PRIVATE")
      .field("registrationNumber", "UNKNOWN-001")
      .field("country", "Kenya")
      .field("region", "Nairobi")
      .field("city", "Nairobi")
      .attach("registrationCertificate", fakePdfBuffer("reg"), "unknown-001-reg.pdf")
      .attach("taxRegistration", fakePdfBuffer("tax"), "unknown-001-tax.pdf")
      .attach("proofOfAddress", fakePdfBuffer("address"), "unknown-001-address.pdf")
      .attach("representativeId", fakePdfBuffer("rep"), "unknown-001-rep.pdf");

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("REGISTRY_VERIFICATION_FAILED");
  });

  test("searches approved government hospitals for autosuggest", async () => {
    await GovernmentHospitalRegistry.create({
      officialName: "Nairobi West Approved Hospital",
      registrationNumber: "MOH-NAIROBI-001",
      hospitalType: "PRIVATE",
      status: "ACTIVE",
      location: {
        country: "Kenya",
        region: "Nairobi",
        city: "Nairobi",
        address: "Westlands",
      },
      contact: { email: "admin@nwai.test", phone: "+254700000001" },
      approvedAt: new Date(),
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    });

    const res = await request(app)
      .get("/api/hospitals/registry/search?q=Nairobi%20West")
      .set("Authorization", `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items[0].registrationNumber).toBe("MOH-NAIROBI-001");
  });

  test("creates a verified hospital when registry match and documents are valid", async () => {
    const res = await request(app)
      .post("/api/hospitals")
      .set("Authorization", `Bearer ${superAdminToken}`)
      .field("name", "Nairobi West Approved Hospital")
      .field("type", "PRIVATE")
      .field("registrationNumber", "MOH-NAIROBI-001")
      .field("country", "Kenya")
      .field("region", "Nairobi")
      .field("city", "Nairobi")
      .field("address", "Westlands")
      .field("email", "hello@nwai.test")
      .field("phone", "+254700000001")
      .attach("registrationCertificate", fakePdfBuffer("reg"), "nairobi-west-approved-hospital-moh-nairobi-001-reg.pdf")
      .attach("taxRegistration", fakePdfBuffer("tax"), "nairobi-west-approved-hospital-moh-nairobi-001-tax.pdf")
      .attach("proofOfAddress", fakePdfBuffer("address"), "nairobi-west-approved-hospital-moh-nairobi-001-address.pdf")
      .attach("representativeId", fakePdfBuffer("rep"), "nairobi-west-approved-hospital-moh-nairobi-001-rep.pdf");

    expect(res.status).toBe(201);
    expect(res.body.verification.status).toBe("VERIFIED");
    expect(res.body.hospital.verification.publicVisible).toBe(true);
    expect(res.body.hospital.securityControls.requireTwoFactorForAdmins).toBe(true);
  });

  test("blocks hospital admin assignment for unverified hospitals", async () => {
    const unverifiedHospital = await Hospital.create({
      name: "Manual Pending Hospital",
      code: "MANUAL-PENDING-HOSPITAL",
      active: true,
      verification: {
        status: "REVIEW_REQUIRED",
        registrationNumber: "MANUAL-PENDING-001",
      },
    });

    const res = await request(app)
      .post("/api/super-admin/register-hospital-admin")
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send({
        name: "Pending Admin",
        email: "pending-admin@afya.test",
        password: "Admin123!",
        hospitalId: String(unverifiedHospital._id),
      });

    expect(res.status).toBe(400);
    expect(String(res.body.msg || "")).toMatch(/government verified/i);
  });

  test("public marketplace hides unverified hospitals", async () => {
    await Hospital.create({
      name: "Fake Public Listing Hospital",
      code: "FAKE-PUBLIC-LISTING-HOSPITAL",
      active: true,
      verification: {
        status: "REVIEW_REQUIRED",
        registrationNumber: "FAKE-LISTING-001",
        publicVisible: false,
      },
    });

    const res = await request(app)
      .get("/api/hospitals/marketplace?limit=50")
      .set("Authorization", `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    const names = (res.body.items || []).map((row) => row.name);
    expect(names).toContain("Nairobi West Approved Hospital");
    expect(names).not.toContain("Fake Public Listing Hospital");
  });
});
