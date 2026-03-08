import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app.js";
import setup from "./setupTestEnv.js";
import User from "../models/User.js";
import Hospital from "../models/Hospital.js";
import RecruitmentAd from "../models/RecruitmentAd.js";
import RecruitmentApplication from "../models/RecruitmentApplication.js";

let teardown;
let hospital;
let hospitalAdmin;
let patient;
let hospitalAdminToken;
let patientToken;

function signToken(user) {
  return jwt.sign(
    { id: String(user._id), twoFactorVerified: true },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
  );
}

function fakeResumeBuffer(label) {
  return Buffer.from(`Resume:${label}\nClinical experience\n`, "utf8");
}

beforeAll(async () => {
  teardown = await setup();

  hospital = await Hospital.create({
    name: "Recruitment Test Hospital",
    code: "RECRUITMENT-TEST-HOSPITAL",
    active: true,
    features: { recruitmentAds: true },
    subscription: { paid: true, status: "ACTIVE", premiumPaused: false },
  });

  hospitalAdmin = await User.create({
    name: "Recruitment Admin",
    email: "recruitment-admin@afya.test",
    password: "Admin123!",
    role: "HOSPITAL_ADMIN",
    hospital: hospital._id,
    active: true,
  });

  patient = await User.create({
    name: "Candidate User",
    email: "candidate-user@afya.test",
    password: "Patient123!",
    role: "PATIENT",
    active: true,
  });

  hospitalAdminToken = signToken(hospitalAdmin);
  patientToken = signToken(patient);
});

afterAll(async () => {
  if (teardown) await teardown();
});

describe("Recruitment ads premium workflow", () => {
  test("tracks recruitment ad interaction events with source attribution", async () => {
    const ad = await RecruitmentAd.create({
      hospital: hospital._id,
      createdBy: hospitalAdmin._id,
      title: "ICU Nurse",
      description: "Critical care nurse campaign",
      visibility: "PUBLIC",
      applicationMode: "INTERNAL",
      status: "ACTIVE",
    });

    const res = await request(app)
      .post(`/api/recruitment-ads/${ad._id}/track`)
      .send({ event: "CAREERS_PAGE_CLICK", source: "LOGIN_PAGE" });

    expect(res.status).toBe(200);

    const updated = await RecruitmentAd.findById(ad._id).lean();
    expect(updated.analytics.careersPageClickCount).toBe(1);
    expect(updated.analytics.sourceAttribution?.LOGIN_PAGE).toBe(1);
    expect(updated.analytics.eventSourceAttribution?.careersPageClickCount?.LOGIN_PAGE).toBe(1);
    expect(updated.analytics.lastInteractionAt).toBeTruthy();
  });

  test("accepts resume file upload for internal applications", async () => {
    const ad = await RecruitmentAd.create({
      hospital: hospital._id,
      createdBy: hospitalAdmin._id,
      title: "Radiology Technologist",
      description: "Join our imaging team",
      visibility: "PUBLIC",
      applicationMode: "INTERNAL",
      status: "ACTIVE",
    });

    const res = await request(app)
      .post(`/api/recruitment-ads/${ad._id}/apply`)
      .set("Authorization", `Bearer ${patientToken}`)
      .field("fullName", "Candidate User")
      .field("email", "candidate-user@afya.test")
      .field("source", "PATIENT_DASHBOARD")
      .field("coverLetter", "I have relevant imaging experience.")
      .attach("resumeFile", fakeResumeBuffer("radiology"), "candidate-resume.txt");

    expect(res.status).toBe(201);
    expect(res.body.application.resumeFile).toBeTruthy();
    expect(res.body.application.resumeFile.publicUrl).toMatch(/recruitment-applications/);

    const saved = await RecruitmentApplication.findById(res.body.application._id).lean();
    expect(saved.resumeFile?.publicUrl).toMatch(/recruitment-applications/);

    const updatedAd = await RecruitmentAd.findById(ad._id).lean();
    expect(updatedAd.analytics.internalApplyCount).toBe(1);
    expect(updatedAd.analytics.sourceAttribution?.PATIENT_DASHBOARD).toBe(1);
  });

  test("allows public careers listing and records direct careers source views", async () => {
    const ad = await RecruitmentAd.create({
      hospital: hospital._id,
      createdBy: hospitalAdmin._id,
      title: "Public Careers Listing",
      description: "Open to public candidates",
      visibility: "PUBLIC",
      applicationMode: "INTERNAL",
      status: "ACTIVE",
    });

    const res = await request(app).get("/api/recruitment-ads?source=DIRECT_CAREERS&limit=20");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);

    const updated = await RecruitmentAd.findById(ad._id).lean();
    expect(updated.analytics.viewCount).toBeGreaterThan(0);
    expect(updated.analytics.sourceAttribution?.DIRECT_CAREERS).toBeGreaterThan(0);
  });

  test("blocks private-link applications without matching access token", async () => {
    const ad = await RecruitmentAd.create({
      hospital: hospital._id,
      createdBy: hospitalAdmin._id,
      title: "Confidential Executive Role",
      description: "Private search",
      visibility: "PRIVATE_LINK",
      applicationMode: "INTERNAL",
      status: "ACTIVE",
      metadata: { privateAccessToken: "secret-token-001" },
    });

    const blocked = await request(app)
      .post(`/api/recruitment-ads/${ad._id}/apply`)
      .set("Authorization", `Bearer ${patientToken}`)
      .field("fullName", "Candidate User")
      .field("email", "candidate-user@afya.test");

    expect(blocked.status).toBe(403);

    const allowed = await request(app)
      .post(`/api/recruitment-ads/${ad._id}/apply`)
      .set("Authorization", `Bearer ${patientToken}`)
      .field("fullName", "Candidate User")
      .field("email", "candidate-user@afya.test")
      .field("privateAccessToken", "secret-token-001");

    expect(allowed.status).toBe(201);
  });
});
