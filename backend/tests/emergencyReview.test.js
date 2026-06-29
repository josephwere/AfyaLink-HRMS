import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app.js";
import setup from "./setupTestEnv.js";
import User from "../models/User.js";
import Hospital from "../models/Hospital.js";
import EmergencySession from "../models/EmergencySession.js";
import EmergencyReview from "../models/EmergencyReview.js";

let teardown;

beforeAll(async () => {
  teardown = await setup();
});
afterAll(async () => {
  if (teardown) await teardown();
});

test("supervisor can review emergency session and unauthorized cannot", async () => {
  const [hospital] = await Hospital.create([{ name: "R-HOSP", code: "R", active: true }]);

  const admin = await User.create({ name: "Admin", email: "admin@r.test", password: "Pass123!", role: "HOSPITAL_ADMIN", hospital: hospital._id, active: true, emailVerified: true });
  const reviewer = await User.create({ name: "Reviewer", email: "rev@r.test", password: "Pass123!", role: "HOSPITAL_ADMIN", hospital: hospital._id, active: true, emailVerified: true });
  const nurse = await User.create({ name: "Nurse", email: "n@r.test", password: "Pass123!", role: "NURSE", hospital: hospital._id, active: true, emailVerified: true });

  const adminToken = jwt.sign({ id: String(admin._id), twoFactorVerified: true }, process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET);
  const reviewerToken = jwt.sign({ id: String(reviewer._id), twoFactorVerified: true }, process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET);
  const nurseToken = jwt.sign({ id: String(nurse._id), twoFactorVerified: true }, process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET);

  // Activate emergency
  const actRes = await request(app).post("/api/emergency/activate").set("Authorization", `Bearer ${adminToken}`).send({ reason: "Review test", durationMinutes: 10 });
  expect(actRes.status).toBe(201);
  const { token, sessionId } = actRes.body;
  expect(token).toBeTruthy();
  expect(sessionId).toBeTruthy();

  const session = await EmergencySession.findById(sessionId).lean();
  expect(session).toBeTruthy();
  expect(session.active).toBe(true);

  // Unauthorized user (nurse) cannot review
  const badReview = await request(app).patch(`/api/emergency/sessions/${sessionId}/review`).set("Authorization", `Bearer ${nurseToken}`).send({ status: "APPROVED", notes: "ok" });
  expect([401, 403]).toContain(badReview.status);

  // Authorized reviewer approves
  const goodReview = await request(app).patch(`/api/emergency/sessions/${sessionId}/review`).set("Authorization", `Bearer ${reviewerToken}`).send({ status: "APPROVED", notes: "Looks good" });
  expect(goodReview.status).toBe(200);

  const review = await EmergencyReview.findOne({ session: sessionId }).lean();
  expect(review).toBeTruthy();
  expect(review.status).toBe("APPROVED");
  expect(review.notes).toBe("Looks good");

  const updated = await EmergencySession.findById(sessionId).lean();
  expect(updated.reviewStatus).toBe("APPROVED");
  expect(String(updated.reviewedBy)).toBe(String(reviewer._id));
});
