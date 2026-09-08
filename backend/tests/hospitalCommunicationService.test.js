import { jest } from "@jest/globals";

const HospitalCommunicationTemplate = {
  findOne: jest.fn(() => ({ lean: jest.fn() })),
  findOneAndUpdate: jest.fn(),
  find: jest.fn(() => ({ sort: jest.fn(() => ({ lean: jest.fn() })) })),
};

const HospitalBroadcast = {
  create: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
};

const HospitalNotificationLog = {
  create: jest.fn(),
  find: jest.fn(),
  aggregate: jest.fn(),
};

const Notification = {
  create: jest.fn(),
};

const User = {
  find: jest.fn(),
};

const Patient = {
  find: jest.fn(),
};

const Appointment = {
  find: jest.fn(),
};

jest.unstable_mockModule("../models/HospitalCommunicationTemplate.js", () => ({
  default: HospitalCommunicationTemplate,
}));

jest.unstable_mockModule("../models/HospitalBroadcast.js", () => ({
  default: HospitalBroadcast,
}));

jest.unstable_mockModule("../models/HospitalNotificationLog.js", () => ({
  default: HospitalNotificationLog,
}));

jest.unstable_mockModule("../models/Notification.js", () => ({
  default: Notification,
}));

jest.unstable_mockModule("../models/User.js", () => ({
  default: User,
}));

jest.unstable_mockModule("../models/Patient.js", () => ({
  default: Patient,
}));

jest.unstable_mockModule("../models/Appointment.js", () => ({
  default: Appointment,
}));

jest.unstable_mockModule("../utils/mailer.js", () => ({
  sendEmail: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.unstable_mockModule("../services/notificationService.js", () => ({
  sendSMS: jest.fn().mockResolvedValue({ provider: "log" }),
  sendWhatsApp: jest.fn().mockResolvedValue({ provider: "log" }),
}));

const { findHospitalTemplate, upsertHospitalTemplate, getHospitalCommunicationAnalytics, getHospitalCommunicationAnalyticsDrilldown, buildHospitalAudienceRecipients, sendHospitalBroadcast } = await import("../services/hospitalCommunicationService.js");

describe("hospital communication service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("falls back to the platform default template when the hospital has not customized one", async () => {
    HospitalCommunicationTemplate.findOne.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValueOnce(null),
    });

    const item = await findHospitalTemplate({
      hospitalId: "hospital-1",
      eventType: "APPOINTMENT_CONFIRMED",
      channel: "EMAIL",
    });

    expect(item).toMatchObject({
      isDefault: true,
      channel: "EMAIL",
      eventType: "APPOINTMENT_CONFIRMED",
      subject: "Appointment Confirmed - {{hospitalName}}",
    });
    expect(item.body).toContain("{{patientName}}");
  });

  it("stores a hospital template with the placeholder list", async () => {
    HospitalCommunicationTemplate.findOneAndUpdate.mockResolvedValueOnce({
      _id: "tpl-123",
      hospitalId: "hospital-1",
      eventType: "APPOINTMENT_REMINDER",
      channel: "SMS",
      subject: "",
      body: "Reminder for {{patientName}} at {{appointmentTime}}.",
    });

    const item = await upsertHospitalTemplate({
      hospitalId: "hospital-1",
      actorId: "actor-1",
      eventType: "APPOINTMENT_REMINDER",
      channel: "SMS",
      subject: "",
      body: "Reminder for {{patientName}} at {{appointmentTime}}.",
      isDefault: false,
      isActive: true,
    });

    expect(HospitalCommunicationTemplate.findOneAndUpdate).toHaveBeenCalled();
    expect(item.body).toContain("{{patientName}}");
  });

  it("returns hospital communication analytics summary by status and channel", async () => {
    HospitalNotificationLog.aggregate.mockResolvedValueOnce([
      { _id: "EMAIL", delivered: 12, failed: 1, queued: 2, read: 8, opened: 5, clicked: 2 },
      { _id: "SMS", delivered: 7, failed: 0, queued: 1, read: 2, opened: 0, clicked: 0 },
    ]);

    const summary = await getHospitalCommunicationAnalytics({ hospitalId: "hospital-1" });

    expect(summary.messagesSent).toBe(23);
    expect(summary.emailsDelivered).toBe(12);
    expect(summary.smsDelivered).toBe(7);
    expect(summary.failedDeliveries).toBe(1);
    expect(summary.queuedMessages).toBe(3);
    expect(summary.readRate).toBeGreaterThanOrEqual(0);
  });

  it("returns a drilldown of campaign analytics per channel and status", async () => {
    HospitalNotificationLog.aggregate.mockResolvedValueOnce([
      { _id: { channel: "EMAIL", eventType: "BROADCAST" }, sent: 10, failed: 1, delivered: 9 },
      { _id: { channel: "SMS", eventType: "BROADCAST" }, sent: 5, failed: 0, delivered: 5 },
    ]);

    const drilldown = await getHospitalCommunicationAnalyticsDrilldown({ hospitalId: "hospital-1" });

    expect(drilldown).toHaveLength(2);
    expect(drilldown[0]).toMatchObject({ channel: "EMAIL", eventType: "BROADCAST" });
  });

  it("rescopes a broadcast audience to hospital patient recipients and staff users", async () => {
    User.find.mockResolvedValueOnce([
      { _id: "user-1", name: "Nurse", email: "nurse@afya.test", phone: "0700000001", role: "NURSE", hospital: "hospital-1" },
    ]);
    Patient.find.mockResolvedValueOnce([
      { _id: "patient-1", firstName: "Asha", lastName: "Njeri", contact: "0700000002", hospital: "hospital-1", dob: new Date("2000-01-01"), gender: "FEMALE" },
    ]);

    const recipients = await buildHospitalAudienceRecipients({
      hospitalId: "hospital-1",
      audience: ["ALL_STAFF", "ALL_PATIENTS"],
    });

    expect(recipients.length).toBe(2);
    expect(recipients.some((item) => item.role === "NURSE")).toBe(true);
    expect(recipients.some((item) => item.role === "PATIENT")).toBe(true);
  });

  it("sends a hospital campaign using the selected campaign ID and channel routing metadata", async () => {
    HospitalCommunicationTemplate.findOne.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValueOnce({
        _id: "tpl-1",
        hospitalId: "hospital-1",
        eventType: "BROADCAST",
        channel: "WHATSAPP",
        subject: "Broadcast",
        body: "Hello {{patientName}}",
        isDefault: false,
        isActive: true,
      }),
    });
    HospitalBroadcast.findById.mockResolvedValueOnce({
      _id: "broadcast-1",
      hospitalId: "hospital-1",
      title: "Campaign",
      message: "Hello",
      audience: ["ALL_PATIENTS"],
      channels: ["WHATSAPP"],
      lean: jest.fn().mockResolvedValueOnce({
        _id: "broadcast-1",
        hospitalId: "hospital-1",
        title: "Campaign",
        message: "Hello",
        audience: ["ALL_PATIENTS"],
        channels: ["WHATSAPP"],
      }),
    });
    HospitalBroadcast.findByIdAndUpdate.mockResolvedValueOnce({ status: "SENT" });
    User.find.mockResolvedValueOnce([]);
    Patient.find.mockResolvedValueOnce([
      { _id: "patient-1", firstName: "Asha", lastName: "Njeri", contact: "0700000002", hospital: "hospital-1", dob: new Date("2000-01-01"), gender: "FEMALE" },
    ]);
    HospitalNotificationLog.create.mockResolvedValue({});

    const result = await sendHospitalBroadcast({ hospitalId: "hospital-1", broadcastId: "broadcast-1" });

    expect(result.broadcast.title).toBe("Campaign");
    expect(HospitalNotificationLog.create).toHaveBeenCalled();
  });
});
