import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app.js";
import setup from "./setupTestEnv.js";
import User from "../models/User.js";
import Hospital from "../models/Hospital.js";
import Notification from "../models/Notification.js";
import { notify } from "../services/notificationService.js";

let teardown;
let hospitalAdminToken;
let hospitalAdminId;
let hospitalId;

beforeAll(async () => {
  teardown = await setup();

  const hospital = await Hospital.create({
    name: "Notification Filter Hospital",
    code: "NOTIF-FILTER-HOSP",
    active: true,
  });
  hospitalId = hospital._id;

  const hospitalAdmin = await User.create({
    name: "Notification Admin",
    email: "notification-admin@afya.test",
    password: "Pass123!",
    role: "HOSPITAL_ADMIN",
    hospital: hospital._id,
    active: true,
  });
  hospitalAdminId = hospitalAdmin._id;

  hospitalAdminToken = jwt.sign(
    { id: String(hospitalAdmin._id), twoFactorVerified: true },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
  );

  await notify({
    title: "Pharmacy Coverage Risk",
    body: "Pharmacy is enabled, but no pharmacist is linked to a registered pharmacy yet.",
    category: "PHARMACY",
    user: hospitalAdmin._id,
    hospital: hospital._id,
    read: false,
    meta: {
      type: "PHARMACY_COVERAGE_RISK",
      path: "/hospital-admin/staff?missingRegisteredPharmacy=1&q=pharmacist",
    },
  });

  await notify({
    title: "Training Reminder",
    body: "A nurse needs training renewal.",
    category: "TRAINING",
    user: hospitalAdmin._id,
    hospital: hospital._id,
    read: false,
    meta: { type: "TRAINING_OVERDUE" },
  });

  await notify({
    title: "Old Pharmacy Risk",
    body: "Previously acknowledged pharmacy risk.",
    category: "PHARMACY",
    user: hospitalAdmin._id,
    hospital: hospital._id,
    read: true,
    meta: { type: "PHARMACY_COVERAGE_RISK" },
  });
});

afterAll(async () => {
  if (teardown) await teardown();
});

describe("Notification filtering for pharmacy risk", () => {
  test("returns unread pharmacy notifications only when filtered", async () => {
    const res = await request(app)
      .get("/api/notifications/list?category=PHARMACY&read=false")
      .set("Authorization", `Bearer ${hospitalAdminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items).toHaveLength(1);
    expect(String(res.body.items[0].user)).toBe(String(hospitalAdminId));
    expect(String(res.body.items[0].hospital)).toBe(String(hospitalId));
    expect(res.body.items[0].category).toBe("PHARMACY");
    expect(res.body.items[0].meta?.type).toBe("PHARMACY_COVERAGE_RISK");
    expect(res.body.items[0].meta?.path).toBe("/hospital-admin/staff?missingRegisteredPharmacy=1&q=pharmacist");
  });
});
