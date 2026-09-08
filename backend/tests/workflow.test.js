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
  const hospital = await Hospital.create({ name: "Workflow Test Hospital", active: true });
  hospitalId = hospital._id;

  const cashier = await User.create({
    name: "Cashier User",
    email: "wf-cashier@afya.test",
    password: "Cashier123!",
    role: "RECEPTIONIST",
    hospital: hospital._id,
    active: true,
  });

  const approver = await User.create({
    name: "Workflow Approver",
    email: "wf-approver@afya.test",
    password: "Approver123!",
    role: "FINANCE_MANAGER",
    hospital: hospital._id,
    active: true,
  });

  cashierToken = jwt.sign({ id: String(cashier._id), twoFactorVerified: true }, process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET);
  approverToken = jwt.sign({ id: String(approver._id), twoFactorVerified: true }, process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET);
});

afterAll(async () => {
  if (teardown) await teardown();
});

describe("Workflow integration tests", () => {
  let shiftId;
  let workItemId;

  test("cashier opens and closes shift, creating a work item", async () => {
    const openRes = await request(app).post("/api/finance/shifts").set("Authorization", `Bearer ${cashierToken}`).send({ openingFloat: 1000 });
    expect(openRes.status).toBe(201);
    shiftId = openRes.body._id;

    const closeRes = await request(app)
      .post(`/api/finance/shifts/${shiftId}/close`)
      .set("Authorization", `Bearer ${cashierToken}`)
      .send({ counts: { cash: 1200 }, expectedTotal: 1200, actualTotal: 1200, variance: 0, reason: "end" });

    expect(closeRes.status).toBe(200);
    // the controller creates a work item; confirm it exists via workflow list
    const listRes = await request(app).get('/api/workflow/items').set('Authorization', `Bearer ${approverToken}`);
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    const wf = listRes.body.find((i) => i.metadata && i.metadata.shiftId === shiftId);
    expect(wf).toBeDefined();
    workItemId = wf._id;
  });

  test("approver can approve via workflow action", async () => {
    const res = await request(app)
      .post(`/api/workflow/items/${workItemId}/action`)
      .set("Authorization", `Bearer ${approverToken}`)
      .send({ action: 'approve' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    // verify shift status updated
    const shiftRes = await request(app).get(`/api/finance/shifts/${shiftId}`).set('Authorization', `Bearer ${approverToken}`);
    expect(shiftRes.status).toBe(200);
    expect(shiftRes.body.status).toBe('APPROVED');
  });
});
