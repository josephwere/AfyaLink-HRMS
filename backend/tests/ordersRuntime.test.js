import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app.js";
import setup from "./setupTestEnv.js";
import Hospital from "../models/Hospital.js";
import User from "../models/User.js";
import Patient from "../models/Patient.js";
import LabOrder from "../models/LabOrder.js";

let teardown;
let doctorToken;
let hospitalId;
let patientId;

beforeAll(async () => {
  teardown = await setup();

  const hospital = await Hospital.create({
    name: "Orders Runtime Hospital",
    code: "ORDERS-RT",
    active: true,
    features: { pharmacy: true, payments: true },
  });
  hospitalId = String(hospital._id);

  const doctor = await User.create({
    name: "Orders Doctor",
    email: "orders-doctor@afya.test",
    password: "Pass123!",
    role: "DOCTOR",
    hospital: hospital._id,
    active: true,
    emailVerified: true,
  });

  const patient = await Patient.create({
    firstName: "Order",
    lastName: "Patient",
    hospital: hospital._id,
    nationalId: "ORD-001",
    contact: "+254700001001",
    active: true,
    metadata: { userId: doctor._id },
  });
  patientId = String(patient._id);

  doctorToken = jwt.sign(
    { id: String(doctor._id), twoFactorVerified: true, hospital: hospitalId, role: "DOCTOR" },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
  );
});

afterAll(async () => {
  if (teardown) await teardown();
});

test("orders runtime can create, transition, and cancel lab orders", async () => {
  const createRes = await request(app)
    .post("/api/orders")
    .set("Authorization", `Bearer ${doctorToken}`)
    .send({
      patientId,
      hospitalId,
      type: "LAB",
      testName: "CBC",
      notes: "Routine check",
    });

  expect(createRes.status).toBe(201);
  expect(createRes.body.item).toBeTruthy();
  expect(String(createRes.body.item.patient)).toBe(patientId);
  expect(createRes.body.item.status).toBe("Pending");

  const orderId = createRes.body.item._id;

  const completeRes = await request(app)
    .post(`/api/orders/${orderId}/transition`)
    .set("Authorization", `Bearer ${doctorToken}`)
    .send({ to: "COMPLETED", result: "Normal", notes: "Completed" });

  expect(completeRes.status).toBe(200);
  expect(completeRes.body.item.status).toBe("Completed");
  expect(completeRes.body.item.metadata?.lastEvent).toBe("ORDER_COMPLETED");

  const cancelRes = await request(app)
    .post(`/api/orders/${orderId}/cancel`)
    .set("Authorization", `Bearer ${doctorToken}`)
    .send({ notes: "No longer needed" });

  expect(cancelRes.status).toBe(409);

  const storedOrder = await LabOrder.findById(orderId).lean();
  expect(storedOrder?.status).toBe("Completed");
});
