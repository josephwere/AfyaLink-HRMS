import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app.js";
import setup from "./setupTestEnv.js";
import User from "../models/User.js";
import Hospital from "../models/Hospital.js";

let teardown;
let cashierToken;
let approverToken;
let hospitalId;

beforeAll(async () => {
  teardown = await setup();
  const hospital = await Hospital.create({ name: "Test Hospital Finance", active: true });
  hospitalId = hospital._id;

  const cashier = await User.create({
    name: "Cashier User",
    email: "cashier@afya.test",
    password: "Cashier123!",
    role: "RECEPTIONIST",
    hospital: hospital._id,
    active: true,
  });

  const approver = await User.create({
    name: "Finance Approver",
    email: "approver@afya.test",
    password: "Approver123!",
    role: "FINANCE_MANAGER",
    hospital: hospital._id,
    active: true,
  });

  cashierToken = jwt.sign(
    { id: String(cashier._id), twoFactorVerified: true },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
  );
  approverToken = jwt.sign(
    { id: String(approver._id), twoFactorVerified: true },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
  );
});

afterAll(async () => {
  if (teardown) await teardown();
});

describe("Cashier shift approval workflow", () => {
  let shiftId;

  test("cashier can open a shift", async () => {
    const res = await request(app)
      .post("/api/finance/shifts")
      .set("Authorization", `Bearer ${cashierToken}`)
      .send({ openingFloat: 5000 });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("OPEN");
    expect(res.body.openingFloat).toBe(5000);
    expect(res.body.cashierName).toBe("Cashier User");
    expect(res.body._id).toBeDefined();
    shiftId = res.body._id;
  });

  test("cashier can submit shift close for approval", async () => {
    const res = await request(app)
      .post(`/api/finance/shifts/${shiftId}/close`)
      .set("Authorization", `Bearer ${cashierToken}`)
      .send({
        counts: { cash: 12000, mpesa: 3000, card: 1500, bank: 0, insurance: 0, refunds: 0 },
        expectedTotal: 16500,
        actualTotal: 16500,
        variance: 0,
        reason: "End of day reconciliation",
        notes: "Shift closed and sent for supervisor approval.",
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("UNDER_REVIEW");
    expect(res.body.expectedTotal).toBe(16500);
    expect(res.body.actualTotal).toBe(16500);
    expect(res.body.submittedAt).toBeDefined();
  });

  test("finance approver can view pending cashier shift closures via the pending-approval contract", async () => {
    const res = await request(app)
      .get("/api/finance/shifts")
      .set("Authorization", `Bearer ${approverToken}`)
      .query({ status: "PENDING_APPROVAL" });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((shift) => shift._id === shiftId)).toBe(true);
  });

  test("cashier cannot approve own shift close", async () => {
    const res = await request(app)
      .post(`/api/finance/shifts/${shiftId}/approve`)
      .set("Authorization", `Bearer ${cashierToken}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/(Approver must be different|insufficient role)/);
  });

  test("finance approver can approve cashier shift close", async () => {
    const res = await request(app)
      .post(`/api/finance/shifts/${shiftId}/approve`)
      .set("Authorization", `Bearer ${approverToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("APPROVED");
    expect(res.body.approvedBy).toBeDefined();
    expect(res.body.approvedAt).toBeDefined();
  });
});
