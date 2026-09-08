import mongoose from "mongoose";
import HospitalCommunicationTemplate from "../models/HospitalCommunicationTemplate.js";
import HospitalBroadcast from "../models/HospitalBroadcast.js";
import HospitalNotificationLog from "../models/HospitalNotificationLog.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import Appointment from "../models/Appointment.js";
import Patient from "../models/Patient.js";
import { sendEmail } from "../utils/mailer.js";
import { sendSMS, sendWhatsApp } from "../services/notificationService.js";

const DEFAULT_TEMPLATES = {
  EMAIL: {
    APPOINTMENT_CONFIRMED: {
      subject: "Appointment Confirmed - {{hospitalName}}",
      body: "Dear {{patientName}},\n\nYour appointment has been successfully booked.\n\nDoctor: {{doctorName}}\nDate: {{appointmentDate}}\nTime: {{appointmentTime}}\nLocation: {{hospitalName}}\n\nThank you for choosing us.\n\n{{hospitalSignature}}",
    },
    APPOINTMENT_REMINDER: {
      subject: "Appointment Reminder - {{hospitalName}}",
      body: "Reminder:\n\nYou have an appointment tomorrow at {{appointmentTime}}.\nPlease arrive 20 minutes early.\n\n{{hospitalName}}",
    },
    APPOINTMENT_COMPLETED: {
      subject: "Thank you for visiting {{hospitalName}}",
      body: "Thank you for visiting our hospital today.\n\nWe wish you a quick recovery.\n\nIf your condition changes, kindly book another appointment or contact us.\n\nRegards,\n\n{{hospitalName}}",
    },
    APPOINTMENT_CANCELLED: {
      subject: "Appointment Cancelled",
      body: "Your appointment has been cancelled.\n\nPlease book another convenient time.\n\nThank you.",
    },
    NEW_SERVICE: {
      subject: "New Service Available - {{hospitalName}}",
      body: "We are pleased to announce a new service at {{hospitalName}}.\n\nPlease visit our front desk or book using the AfyaLink platform.\n\nThank you.",
    },
    HOLIDAY_CLOSURE: {
      subject: "Holiday Closure Notice - {{hospitalName}}",
      body: "Dear patient,\n\nOur hospital will be closed on {{holidayDate}}.\n\nPlease plan your visit accordingly.\n\n{{hospitalName}}",
    },
  },
  SMS: {
    APPOINTMENT_CONFIRMED: {
      subject: "",
      body: "Dear {{patientName}},\nYour appointment is confirmed for {{appointmentDate}} at {{appointmentTime}}.\n{{hospitalName}}",
    },
    APPOINTMENT_REMINDER: {
      subject: "",
      body: "Reminder: you have an appointment tomorrow at {{appointmentTime}}. Please arrive 20 minutes early.",
    },
    NEW_SERVICE: {
      subject: "",
      body: "New service now available at {{hospitalName}}. Book today.",
    },
    HOLIDAY_CLOSURE: {
      subject: "",
      body: "Hospital closure notice: {{hospitalName}} is closed on {{holidayDate}}.",
    },
  },
  PUSH: {
    APPOINTMENT_CONFIRMED: {
      subject: "Appointment confirmed",
      body: "Your appointment has been confirmed with {{doctorName}} on {{appointmentDate}}.",
    },
    APPOINTMENT_REMINDER: {
      subject: "Appointment reminder",
      body: "You have an appointment with {{doctorName}} tomorrow.",
    },
    NEW_SERVICE: {
      subject: "New service available",
      body: "A new {{serviceName}} service is now available at {{hospitalName}}.",
    },
  },
  IN_APP: {
    APPOINTMENT_CONFIRMED: {
      subject: "Appointment confirmed",
      body: "Your appointment has been confirmed with {{doctorName}}.",
    },
    APPOINTMENT_REMINDER: {
      subject: "Appointment reminder",
      body: "Reminder: your appointment is scheduled for {{appointmentDate}}.",
    },
    NEW_SERVICE: {
      subject: "New service announcement",
      body: "{{hospitalName}} has announced a new service: {{serviceName}}.",
    },
  },
};

function renderTemplate(template = "", context = {}) {
  return String(template || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const value = context[key];
    return value == null ? "" : String(value);
  });
}

function extractPlaceholders(template = "") {
  return Array.from(new Set(String(template).match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g) || [])).map((token) => token.replace(/\{\{|\}\}/g, "").trim());
}

export async function findHospitalTemplate({ hospitalId, eventType, channel }) {
  const template = await HospitalCommunicationTemplate.findOne({
    hospitalId,
    eventType,
    channel,
    isActive: true,
  }).lean();

  if (template) return template;

  const defaultTemplate = DEFAULT_TEMPLATES?.[channel]?.[eventType];
  if (defaultTemplate) {
    return {
      _id: null,
      hospitalId,
      eventType,
      channel,
      subject: defaultTemplate.subject || "",
      body: defaultTemplate.body || "",
      isDefault: true,
      isActive: true,
      placeholders: extractPlaceholders(defaultTemplate.subject || "" + "\n" + defaultTemplate.body || ""),
    };
  }

  return null;
}

export async function listHospitalTemplates({ hospitalId, actorRole = "" } = {}) {
  if (!hospitalId) return [];
  const rows = await HospitalCommunicationTemplate.find({ hospitalId }).sort({ updatedAt: -1 }).lean();
  return rows;
}

export async function upsertHospitalTemplate({ hospitalId, actorId, eventType, channel, subject = "", body = "", isDefault = false, isActive = true }) {
  if (!hospitalId || !eventType || !channel || !body) {
    throw new Error("hospitalId, eventType, channel, and body are required");
  }

  const placeholders = extractPlaceholders(`${subject}\n${body}`);
  const payload = {
    hospitalId,
    eventType,
    channel,
    subject,
    body,
    isDefault,
    isActive,
    placeholders,
    createdBy: actorId,
    updatedBy: actorId,
  };

  const doc = await HospitalCommunicationTemplate.findOneAndUpdate(
    { hospitalId, eventType, channel },
    { $set: payload },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return doc;
}

export async function createHospitalBroadcast({
  hospitalId,
  actorId,
  title,
  message,
  audience = ["ALL_PATIENTS"],
  channels = ["IN_APP"],
  scheduledAt = null,
  campaignType = "IMMEDIATE",
  frequency = null,
}) {
  if (!hospitalId || !title || !message) {
    throw new Error("hospitalId, title, and message are required");
  }

  const isScheduled = Boolean(scheduledAt) || campaignType === "SCHEDULED" || campaignType === "RECURRING";

  return HospitalBroadcast.create({
    hospitalId,
    title,
    message,
    audience,
    channels,
    scheduledAt,
    status: isScheduled ? "SCHEDULED" : "DRAFT",
    campaignType,
    frequency,
    createdBy: actorId,
  });
}

export async function deliverHospitalNotification({
  hospitalId,
  eventType,
  channel,
  recipients = [],
  context = {},
  templateId = null,
  campaignId = null,
}) {
  if (!hospitalId || !Array.isArray(recipients) || !recipients.length) {
    return [];
  }

  const resolved = await findHospitalTemplate({ hospitalId, eventType, channel });
  if (!resolved) {
    return [];
  }

  const subject = renderTemplate(resolved.subject || "", context);
  const body = renderTemplate(resolved.body || "", context);

  const logs = [];
  for (const recipient of recipients) {
    try {
      if (channel === "EMAIL") {
        const to = recipient?.email || recipient?.user?.email;
        if (!to) throw new Error("Recipient email is required for email delivery");
        await sendEmail({
          to,
          subject,
          html: body,
          text: body,
          from: context?.hospitalEmail || undefined,
        });
      } else if (channel === "SMS") {
        const to = recipient?.phone || recipient?.user?.phone;
        if (!to) throw new Error("Recipient phone is required for SMS delivery");
        await sendSMS({ to, message: body });
      } else if (channel === "WHATSAPP") {
        const to = recipient?.phone || recipient?.user?.phone;
        if (!to) throw new Error("Recipient phone is required for WhatsApp delivery");
        await sendWhatsApp({ to, message: body });
      } else {
        await Notification.create({
          title: subject || eventType,
          body,
          category: "HOSPITAL_BROADCAST",
          user: recipient?._id || recipient?.user?._id,
          hospital: hospitalId,
          meta: {
            eventType,
            channel,
          },
        });
      }

      const doc = await HospitalNotificationLog.create({
        hospitalId,
        recipient: recipient?._id || recipient?.user?._id,
        channel,
        templateId: resolved?._id || templateId,
        campaignId,
        eventType,
        deliveryStatus: "SENT",
        subject,
        message: body,
        sentAt: new Date(),
        deliveredAt: new Date(),
      });
      logs.push(doc);
    } catch (err) {
      const doc = await HospitalNotificationLog.create({
        hospitalId,
        recipient: recipient?._id || recipient?.user?._id,
        channel,
        templateId: resolved?._id || templateId,
        campaignId,
        eventType,
        deliveryStatus: "FAILED",
        subject,
        message: body,
        failureReason: err?.message || "Delivery failed",
        sentAt: new Date(),
      });
      logs.push(doc);
    }
  }

  return logs;
}

export async function getHospitalCommunicationAnalytics({ hospitalId } = {}) {
  if (!hospitalId) {
    return {
      messagesSent: 0,
      emailsDelivered: 0,
      smsDelivered: 0,
      pushDelivered: 0,
      readRate: 0,
      openRate: 0,
      clickRate: 0,
      failedDeliveries: 0,
      queuedMessages: 0,
    };
  }

  const match = { hospitalId };
  if (mongoose.isValidObjectId(hospitalId)) {
    match.hospitalId = new mongoose.Types.ObjectId(hospitalId);
  }

  const rows = await HospitalNotificationLog.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$channel",
        delivered: {
          $sum: {
            $cond: [{ $eq: ["$deliveryStatus", "SENT"] }, 1, 0],
          },
        },
        failed: {
          $sum: {
            $cond: [{ $eq: ["$deliveryStatus", "FAILED"] }, 1, 0],
          },
        },
        queued: {
          $sum: {
            $cond: [{ $eq: ["$deliveryStatus", "QUEUED"] }, 1, 0],
          },
        },
        read: {
          $sum: {
            $cond: [{ $ne: ["$readAt", null] }, 1, 0],
          },
        },
        opened: {
          $sum: {
            $cond: [{ $ne: ["$openedAt", null] }, 1, 0],
          },
        },
        clicked: {
          $sum: {
            $cond: [{ $ne: ["$clickedAt", null] }, 1, 0],
          },
        },
      },
    },
  ]);

  const totals = rows.reduce(
    (acc, row) => {
      acc.messagesSent += row.delivered + row.failed + row.queued;
      acc.failedDeliveries += row.failed;
      acc.queuedMessages += row.queued;
      acc.read += row.read;
      acc.opened += row.opened;
      acc.clicked += row.clicked;

      if (row._id === "EMAIL") {
        acc.emailsDelivered += row.delivered;
      }
      if (row._id === "SMS") {
        acc.smsDelivered += row.delivered;
      }
      if (row._id === "PUSH") {
        acc.pushDelivered += row.delivered;
      }
      return acc;
    },
    {
      messagesSent: 0,
      emailsDelivered: 0,
      smsDelivered: 0,
      pushDelivered: 0,
      failedDeliveries: 0,
      queuedMessages: 0,
      read: 0,
      opened: 0,
      clicked: 0,
    }
  );

  const totalSent = Math.max(totals.messagesSent, 1);
  return {
    messagesSent: totals.messagesSent,
    emailsDelivered: totals.emailsDelivered,
    smsDelivered: totals.smsDelivered,
    pushDelivered: totals.pushDelivered,
    failedDeliveries: totals.failedDeliveries,
    queuedMessages: totals.queuedMessages,
    readRate: Math.round((totals.read / totalSent) * 1000) / 10,
    openRate: Math.round((totals.opened / totalSent) * 1000) / 10,
    clickRate: Math.round((totals.clicked / totalSent) * 1000) / 10,
  };
}

export async function getHospitalCommunicationAnalyticsDrilldown({ hospitalId } = {}) {
  if (!hospitalId) return [];

  const match = { hospitalId };
  if (mongoose.isValidObjectId(hospitalId)) {
    match.hospitalId = new mongoose.Types.ObjectId(hospitalId);
  }

  const rows = await HospitalNotificationLog.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          channel: "$channel",
          eventType: "$eventType",
          deliveryStatus: "$deliveryStatus",
        },
        sent: {
          $sum: {
            $cond: [{ $eq: ["$deliveryStatus", "SENT"] }, 1, 0],
          },
        },
        failed: {
          $sum: {
            $cond: [{ $eq: ["$deliveryStatus", "FAILED"] }, 1, 0],
          },
        },
        queued: {
          $sum: {
            $cond: [{ $eq: ["$deliveryStatus", "QUEUED"] }, 1, 0],
          },
        },
      },
    },
  ]);

  return rows.map((row) => ({
    channel: row._id?.channel || "UNKNOWN",
    eventType: row._id?.eventType || "CUSTOM",
    deliveryStatus: row._id?.deliveryStatus || "UNKNOWN",
    sent: Number(row.sent || 0),
    failed: Number(row.failed || 0),
    queued: Number(row.queued || 0),
  }));
}

export async function buildHospitalAudienceRecipients({ hospitalId, audience = [] }) {
  const normalizedAudiences = Array.isArray(audience) ? audience : [];
  const roleMap = {
    ALL_PATIENTS: "PATIENT",
    ALL_DOCTORS: "DOCTOR",
    ALL_NURSES: "NURSE",
    ALL_PHARMACISTS: "PHARMACIST",
    ALL_RECEPTIONISTS: "RECEPTIONIST",
    ALL_STAFF: ["HOSPITAL_ADMIN", "DOCTOR", "NURSE", "LAB_TECH", "PHARMACIST", "RECEPTIONIST", "HR_MANAGER", "PAYROLL_OFFICER"],
    MALE_PATIENTS: "PATIENT_MALE",
    FEMALE_PATIENTS: "PATIENT_FEMALE",
    CHILDREN: "PATIENT_CHILD",
    ADULTS: "PATIENT_ADULT",
    ELDERLY: "PATIENT_ELDERLY",
    NEW_PATIENTS: "PATIENT_NEW",
    VIP_PATIENTS: "PATIENT_VIP",
  };

  const queryRoles = [];
  const patientAgeFilters = [];
  const patientVips = [];
  for (const entry of normalizedAudiences) {
    if (roleMap[entry]) {
      const value = roleMap[entry];
      if (Array.isArray(value)) queryRoles.push(...value);
      else queryRoles.push(value);
    }
    if (entry === "NEW_PATIENTS") patientVips.push("NEW");
    if (entry === "VIP_PATIENTS") patientVips.push("VIP");
  }

  let recipientUsers = [];
  const userQuery = User.find({ hospital: hospitalId, active: true, role: { $in: queryRoles } });
  if (userQuery && typeof userQuery.select === "function") {
    recipientUsers = await userQuery.select("_id name email phone role hospital").lean();
  } else if (Array.isArray(userQuery)) {
    recipientUsers = userQuery;
  } else {
    recipientUsers = await Promise.resolve(userQuery);
  }

  const patientQuery = { hospital: hospitalId, active: true };
  for (const audienceEntry of normalizedAudiences) {
    if (audienceEntry === "MALE_PATIENTS") patientQuery.gender = "MALE";
    if (audienceEntry === "FEMALE_PATIENTS") patientQuery.gender = "FEMALE";
    if (audienceEntry === "CHILDREN") patientAgeFilters.push("CHILDREN");
    if (audienceEntry === "ADULTS") patientAgeFilters.push("ADULTS");
    if (audienceEntry === "ELDERLY") patientAgeFilters.push("ELDERLY");
  }

  let patientRows = [];
  const shouldIncludePatients = normalizedAudiences.some((item) => ["ALL_PATIENTS", "MALE_PATIENTS", "FEMALE_PATIENTS", "CHILDREN", "ADULTS", "ELDERLY", "NEW_PATIENTS", "VIP_PATIENTS"].includes(item));
  if (shouldIncludePatients) {
    const patientQueryResult = Patient.find(patientQuery);
    if (patientQueryResult && typeof patientQueryResult.select === "function") {
      patientRows = await patientQueryResult.select("_id firstName lastName contact hospital dob gender createdAt metadata active").lean();
    } else if (Array.isArray(patientQueryResult)) {
      patientRows = patientQueryResult;
    } else {
      patientRows = await Promise.resolve(patientQueryResult);
    }
    patientRows = patientRows.filter((patient) => {
      if (patient.dob != null) {
        const ageYears = (Date.now() - new Date(patient.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        const ageBucket = ageYears < 18 ? "CHILDREN" : ageYears >= 65 ? "ELDERLY" : "ADULTS";
        const matchesAge = patientAgeFilters.length ? patientAgeFilters.includes(ageBucket) : true;
        const isNewPatient = Boolean(patient.createdAt) && Date.now() - new Date(patient.createdAt).getTime() < 30 * 24 * 60 * 60 * 1000;
        const isVip = Boolean(patient.metadata?.vip || patient.metadata?.isVIP || patient.metadata?.priority === "VIP");
        const matchesNewOrVip = !patientVips.length || (patientVips.includes("NEW") && isNewPatient) || (patientVips.includes("VIP") && isVip);
        return matchesAge && matchesNewOrVip;
      }
      return !!patientVips.length ? false : true;
    });
  }

  const recipients = [
    ...recipientUsers,
    ...patientRows.map((patient) => ({
      _id: patient._id,
      name: `${patient.firstName || ""} ${patient.lastName || ""}`.trim(),
      email: patient.contact || "",
      phone: patient.contact || "",
      role: "PATIENT",
      hospital: patient.hospital,
      user: {
        _id: patient._id,
        email: patient.contact || "",
        phone: patient.contact || "",
      },
    })),
  ];

  return recipients;
}

export async function sendHospitalBroadcast({ hospitalId, broadcastId }) {
  const broadcastDoc = await HospitalBroadcast.findById(broadcastId);
  const broadcast = typeof broadcastDoc?.lean === "function" ? await broadcastDoc.lean() : broadcastDoc;
  if (!broadcast || String(broadcast.hospitalId) !== String(hospitalId)) {
    throw new Error("Broadcast not found");
  }

  const recipients = await buildHospitalAudienceRecipients({ hospitalId, audience: broadcast.audience });
  const logs = [];
  for (const channel of broadcast.channels || []) {
    const channelLogs = await deliverHospitalNotification({
      hospitalId,
      eventType: "BROADCAST",
      channel,
      recipients,
      context: {
        hospitalName: "",
        title: broadcast.title,
        message: broadcast.message,
      },
      templateId: null,
      campaignId: broadcast._id,
    });
    logs.push(...channelLogs);
  }

  await HospitalBroadcast.findByIdAndUpdate(broadcastId, {
    status: "SENT",
  });

  return { broadcast, logs };
}

export async function processScheduledHospitalBroadcasts({ now = new Date() } = {}) {
  const dueBroadcasts = await HospitalBroadcast.find({
    status: "SCHEDULED",
    scheduledAt: { $lte: now },
  }).lean();

  const results = [];
  for (const item of dueBroadcasts) {
    const result = await sendHospitalBroadcast({
      hospitalId: item.hospitalId,
      broadcastId: item._id,
    });
    results.push(result);
  }

  return results;
}
