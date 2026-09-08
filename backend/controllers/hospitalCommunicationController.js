import HospitalCommunicationTemplate from "../models/HospitalCommunicationTemplate.js";
import HospitalBroadcast from "../models/HospitalBroadcast.js";
import HospitalNotificationLog from "../models/HospitalNotificationLog.js";
import { normalizeRole } from "../utils/normalizeRole.js";
import {
  createHospitalBroadcast,
  findHospitalTemplate,
  getHospitalCommunicationAnalytics,
  getHospitalCommunicationAnalyticsDrilldown,
  listHospitalTemplates,
  sendHospitalBroadcast,
  upsertHospitalTemplate,
} from "../services/hospitalCommunicationService.js";

function actorHospital(req) {
  return req.user?.hospitalId || req.user?.hospital || null;
}

function actorRole(req) {
  return normalizeRole(req.user?.actualRole || req.user?.role || "");
}

export async function listHospitalCommunicationTemplates(req, res, next) {
  try {
    const hospitalId = req.query.hospitalId || actorHospital(req);
    if (!hospitalId) {
      return res.status(400).json({ message: "Hospital context is required" });
    }

    const templates = await listHospitalTemplates({ hospitalId });
    return res.json({ success: true, items: templates });
  } catch (err) {
    return next(err);
  }
}

export async function upsertHospitalCommunicationTemplate(req, res, next) {
  try {
    const hospitalId = req.body?.hospitalId || actorHospital(req);
    if (!hospitalId) {
      return res.status(400).json({ message: "Hospital context is required" });
    }
    if (actorRole(req) !== "HOSPITAL_ADMIN") {
      return res.status(403).json({ message: "Only hospital admins can manage hospital templates" });
    }

    const template = await upsertHospitalTemplate({
      hospitalId,
      actorId: req.user._id,
      eventType: req.body?.eventType,
      channel: req.body?.channel,
      subject: req.body?.subject || "",
      body: req.body?.body,
      isDefault: Boolean(req.body?.isDefault),
      isActive: req.body?.isActive !== false,
    });

    return res.status(201).json({ success: true, item: template });
  } catch (err) {
    return next(err);
  }
}

export async function getHospitalTemplatePreview(req, res, next) {
  try {
    const hospitalId = req.query.hospitalId || actorHospital(req);
    const eventType = String(req.query.eventType || "APPOINTMENT_CONFIRMED");
    const channel = String(req.query.channel || "EMAIL");
    if (!hospitalId) {
      return res.status(400).json({ message: "Hospital context is required" });
    }

    const item = await findHospitalTemplate({ hospitalId, eventType, channel });
    return res.json({ success: true, item });
  } catch (err) {
    return next(err);
  }
}

export async function listHospitalBroadcasts(req, res, next) {
  try {
    const hospitalId = req.query.hospitalId || actorHospital(req);
    if (!hospitalId) {
      return res.status(400).json({ message: "Hospital context is required" });
    }
    const items = await HospitalBroadcast.find({ hospitalId }).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, items });
  } catch (err) {
    return next(err);
  }
}

export async function createHospitalBroadcastItem(req, res, next) {
  try {
    const hospitalId = req.body?.hospitalId || actorHospital(req);
    if (!hospitalId) {
      return res.status(400).json({ message: "Hospital context is required" });
    }
    if (actorRole(req) !== "HOSPITAL_ADMIN") {
      return res.status(403).json({ message: "Only hospital admins can create broadcasts" });
    }

    const item = await createHospitalBroadcast({
      hospitalId,
      actorId: req.user._id,
      title: req.body?.title,
      message: req.body?.message,
      audience: Array.isArray(req.body?.audience) ? req.body.audience : ["ALL_PATIENTS"],
      channels: Array.isArray(req.body?.channels) ? req.body.channels : ["IN_APP"],
      scheduledAt: req.body?.scheduledAt ? new Date(req.body.scheduledAt) : null,
    });

    return res.status(201).json({ success: true, item });
  } catch (err) {
    return next(err);
  }
}

export async function sendHospitalBroadcastNow(req, res, next) {
  try {
    const hospitalId = req.params?.hospitalId || actorHospital(req);
    if (!hospitalId) {
      return res.status(400).json({ message: "Hospital context is required" });
    }
    if (actorRole(req) !== "HOSPITAL_ADMIN") {
      return res.status(403).json({ message: "Only hospital admins can send broadcasts" });
    }

    const result = await sendHospitalBroadcast({ hospitalId, broadcastId: req.params.broadcastId });
    return res.json({ success: true, result });
  } catch (err) {
    return next(err);
  }
}

export async function getHospitalCommunicationAnalyticsSummary(req, res, next) {
  try {
    const hospitalId = req.query.hospitalId || actorHospital(req);
    if (!hospitalId) {
      return res.status(400).json({ message: "Hospital context is required" });
    }
    const analytics = await getHospitalCommunicationAnalytics({ hospitalId });
    const drilldown = await getHospitalCommunicationAnalyticsDrilldown({ hospitalId });
    return res.json({ success: true, item: { ...analytics, drilldown } });
  } catch (err) {
    return next(err);
  }
}

export async function listHospitalNotificationLogs(req, res, next) {
  try {
    const hospitalId = req.query.hospitalId || actorHospital(req);
    if (!hospitalId) {
      return res.status(400).json({ message: "Hospital context is required" });
    }
    const items = await HospitalNotificationLog.find({ hospitalId }).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, items });
  } catch (err) {
    return next(err);
  }
}
