import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app.js";
import setup from "./setupTestEnv.js";
import User from "../models/User.js";
import Hospital from "../models/Hospital.js";
import Notification from "../models/Notification.js";
import RegisteredPharmacy from "../models/RegisteredPharmacy.js";

let teardown;
let hospitalAdminToken;
let hospitalId;
let hospitalAdminId;
let secondHospitalAdminId;

beforeAll(async () => {
  teardown = await setup();

  const hospital = await Hospital.create({
    name: "Risk Notification Hospital",
    code: "RISK-NOTIFY-HOSP",
    active: true,
    features: { pharmacy: false },
  });
  hospitalId = hospital._id;

  const hospitalAdmin = await User.create({
    name: "Risk Notify Admin",
    email: "risk-notify-admin@afya.test",
    password: "Pass123!",
    role: "HOSPITAL_ADMIN",
    hospital: hospital._id,
    active: true,
  });
  hospitalAdminId = hospitalAdmin._id;

  const secondHospitalAdmin = await User.create({
    name: "Risk Notify Admin Two",
    email: "risk-notify-admin-2@afya.test",
    password: "Pass123!",
    role: "HOSPITAL_ADMIN",
    hospital: hospital._id,
    active: true,
  });
  secondHospitalAdminId = secondHospitalAdmin._id;

  await User.create({
    name: "Unlinked Risk Pharmacist",
    email: "risk-unlinked-pharmacist@afya.test",
    password: "Pass123!",
    role: "PHARMACIST",
    hospital: hospital._id,
    active: true,
  });

  hospitalAdminToken = jwt.sign(
    { id: String(hospitalAdmin._id), twoFactorVerified: true },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
  );
});

afterAll(async () => {
  if (teardown) await teardown();
});

describe("Hospital pharmacy coverage risk notifications", () => {
  test("emits one risk notification per hospital admin with the remediation deep-link", async () => {
    const res = await request(app)
      .put("/api/hospital-admin/features")
      .set("Authorization", `Bearer ${hospitalAdminToken}`)
      .send({ features: { pharmacy: true } });

    expect(res.status).toBe(200);
    expect(res.body.features?.pharmacy).toBe(true);

    const notifications = await Notification.find({
      hospital: hospitalId,
      "meta.type": "PHARMACY_COVERAGE_RISK",
    }).lean();

    expect(notifications).toHaveLength(2);
    expect(
      notifications.every(
        (item) =>
          item?.meta?.path === "/hospital-admin/staff?missingRegisteredPharmacy=1&q=pharmacist"
      )
    ).toBe(true);
    expect(notifications.map((item) => String(item.user)).sort()).toEqual(
      [String(hospitalAdminId), String(secondHospitalAdminId)].sort()
    );
  });

  test("does not duplicate the unread risk notification on repeated feature saves", async () => {
    const res = await request(app)
      .put("/api/hospital-admin/features")
      .set("Authorization", `Bearer ${hospitalAdminToken}`)
      .send({ features: { pharmacy: true, lab: true } });

    expect(res.status).toBe(200);

    const notifications = await Notification.find({
      hospital: hospitalId,
      user: hospitalAdminId,
      "meta.type": "PHARMACY_COVERAGE_RISK",
    }).lean();

    expect(notifications).toHaveLength(1);
  });

  test("does not emit a risk notification when a pharmacist is linked before enablement", async () => {
    const safeHospital = await Hospital.create({
      name: "Safe Pharmacy Coverage Hospital",
      code: "SAFE-RISK-NOTIFY-HOSP",
      active: true,
      features: { pharmacy: false },
    });

    const safeAdmin = await User.create({
      name: "Safe Coverage Admin",
      email: "safe-coverage-admin@afya.test",
      password: "Pass123!",
      role: "HOSPITAL_ADMIN",
      hospital: safeHospital._id,
      active: true,
    });

    const pharmacy = await RegisteredPharmacy.create({
      name: "Safe Coverage Pharmacy",
      licenseNumber: "SAFE-COVERAGE-PHARM-001",
      status: "ACTIVE",
      createdBy: safeAdmin._id,
      updatedBy: safeAdmin._id,
    });

    await User.create({
      name: "Linked Safe Pharmacist",
      email: "linked-safe-pharmacist@afya.test",
      password: "Pass123!",
      role: "PHARMACIST",
      hospital: safeHospital._id,
      registeredPharmacy: pharmacy._id,
      active: true,
    });

    const safeAdminToken = jwt.sign(
      { id: String(safeAdmin._id), twoFactorVerified: true },
      process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
    );

    const res = await request(app)
      .put("/api/hospital-admin/features")
      .set("Authorization", `Bearer ${safeAdminToken}`)
      .send({ features: { pharmacy: true } });

    expect(res.status).toBe(200);

    const notifications = await Notification.find({
      hospital: safeHospital._id,
      user: safeAdmin._id,
      "meta.type": "PHARMACY_COVERAGE_RISK",
    }).lean();

    expect(notifications).toHaveLength(0);
  });
});
