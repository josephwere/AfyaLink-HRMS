import CommunicationChannel from "../models/CommunicationChannel.js";
import CommunicationMessage from "../models/CommunicationMessage.js";
import { logAudit } from "../services/auditService.js";
import { encodeCursor, decodeCursor } from "../utils/cursor.js";
import { getIO } from "../utils/socket.js";
import { normalizeRole } from "../utils/normalizeRole.js";

const DEFAULT_CHANNELS = [
  {
    key: "doctor_lab",
    name: "Doctor ↔ Lab",
    description: "Clinical order/result communication between doctors and lab team.",
    participantRoles: ["DOCTOR", "LAB_TECH", "HOSPITAL_ADMIN"],
  },
  {
    key: "lab_pharmacy",
    name: "Lab ↔ Pharmacy",
    description: "Critical result and medication coordination channel.",
    participantRoles: ["LAB_TECH", "PHARMACIST", "DOCTOR", "HOSPITAL_ADMIN"],
  },
  {
    key: "nurse_doctor",
    name: "Nurse ↔ Doctor",
    description: "Ward updates, escalation, and patient care handoff channel.",
    participantRoles: ["NURSE", "DOCTOR", "HOSPITAL_ADMIN"],
  },
  {
    key: "security_reception",
    name: "Security ↔ Reception",
    description: "Visitor, gate and front-desk operational coordination.",
    participantRoles: ["SECURITY_OFFICER", "SECURITY_ADMIN", "RECEPTIONIST", "HOSPITAL_ADMIN"],
  },
  {
    key: "hospital_operations",
    name: "Hospital Operations",
    description: "Cross-department operations for uninterrupted service delivery.",
    participantRoles: [
      "HOSPITAL_ADMIN",
      "DOCTOR",
      "NURSE",
      "LAB_TECH",
      "PHARMACIST",
      "RECEPTIONIST",
      "SECURITY_OFFICER",
      "SECURITY_ADMIN",
      "HR_MANAGER",
      "PAYROLL_OFFICER",
      "COMMUNITY_HEALTH_WORKER",
    ],
  },
  {
    key: "chw_hospital_operations",
    name: "CHW ↔ Hospital Operations",
    description: "Community health worker coordination with nurses, doctors, lab, pharmacy, and hospital admin.",
    participantRoles: [
      "COMMUNITY_HEALTH_WORKER",
      "HOSPITAL_ADMIN",
      "DOCTOR",
      "NURSE",
      "LAB_TECH",
      "PHARMACIST",
      "HR_MANAGER",
    ],
  },
];

const PRIVILEGED_ROLES = new Set(["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"]);

function actorRole(req) {
  return normalizeRole(req.user?.actualRole || req.user?.role || "");
}

function actorHospital(req) {
  return req.user?.hospitalId || req.user?.hospital || null;
}

function canViewChannel(req, channel) {
  const role = actorRole(req);
  if (PRIVILEGED_ROLES.has(role)) return true;
  if (!channel || String(channel.hospital) !== String(actorHospital(req))) return false;
  const roles = Array.isArray(channel.participantRoles)
    ? channel.participantRoles.map((r) => normalizeRole(r))
    : [];
  if (roles.includes(role)) return true;
  return (channel.participantUsers || []).some((u) => String(u) === String(req.user._id));
}

async function writeAudit(req, action, resourceId, after = null) {
  await logAudit({
    actorId: req.user._id,
    actorRole: actorRole(req),
    action,
    resource: "Communication",
    resourceId,
    hospital: actorHospital(req),
    ip: req.ip,
    userAgent: req.get("user-agent"),
    after,
  });
}

export const bootstrapCommunicationChannels = async (req, res, next) => {
  try {
    const hospital = req.body?.hospitalId || actorHospital(req);
    if (!hospital) return res.status(400).json({ message: "Hospital context is required" });

    const created = [];
    for (const ch of DEFAULT_CHANNELS) {
      const doc = await CommunicationChannel.findOneAndUpdate(
        { hospital, key: ch.key },
        {
          $setOnInsert: {
            hospital,
            key: ch.key,
            name: ch.name,
            description: ch.description,
            participantRoles: ch.participantRoles,
            active: true,
            createdBy: req.user._id,
            updatedBy: req.user._id,
          },
        },
        { upsert: true, new: true }
      );
      created.push(doc);
    }

    await writeAudit(req, "COMM_CHANNELS_BOOTSTRAPPED", hospital, {
      count: created.length,
    });
    return res.json({ success: true, channels: created });
  } catch (err) {
    return next(err);
  }
};

export const listCommunicationChannels = async (req, res, next) => {
  try {
    const role = actorRole(req);
    const hospital = req.query.hospitalId || actorHospital(req);
    const filter = { active: true };

    if (!PRIVILEGED_ROLES.has(role) || hospital) {
      filter.hospital = hospital;
    }

    const channels = await CommunicationChannel.find(filter)
      .sort({ updatedAt: -1 })
      .lean();
    const visible = channels.filter((c) => canViewChannel(req, c));
    return res.json({ success: true, items: visible });
  } catch (err) {
    return next(err);
  }
};

export const listChannelMessages = async (req, res, next) => {
  try {
    const channel = await CommunicationChannel.findById(req.params.channelId).lean();
    if (!channel || !channel.active) {
      return res.status(404).json({ message: "Channel not found" });
    }
    if (!canViewChannel(req, channel)) {
      return res.status(403).json({ message: "Access denied for this channel" });
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit || "30", 10), 1), 100);
    const cursor = req.query.cursor || null;
    const filter = { channel: channel._id };

    if (cursor) {
      const parsed = decodeCursor(cursor);
      if (!parsed?.createdAt || !parsed?._id) {
        return res.status(400).json({ message: "Invalid cursor" });
      }
      filter.$or = [
        { createdAt: { $lt: new Date(parsed.createdAt) } },
        { createdAt: new Date(parsed.createdAt), _id: { $lt: parsed._id } },
      ];
    }

    const rows = await CommunicationMessage.find(filter)
      .populate("sender", "name role")
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items[items.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeCursor({ createdAt: last.createdAt, _id: last._id })
        : null;

    return res.json({ success: true, items, nextCursor, hasMore, limit });
  } catch (err) {
    return next(err);
  }
};

export const sendChannelMessage = async (req, res, next) => {
  try {
    const channel = await CommunicationChannel.findById(req.params.channelId);
    if (!channel || !channel.active) {
      return res.status(404).json({ message: "Channel not found" });
    }
    if (!canViewChannel(req, channel)) {
      return res.status(403).json({ message: "Access denied for this channel" });
    }

    const body = String(req.body?.body || "").trim();
    if (!body) return res.status(400).json({ message: "Message body is required" });

    const attachments = Array.isArray(req.body?.attachments)
      ? req.body.attachments
          .map((a) => ({
            name: String(a?.name || "").trim(),
            url: String(a?.url || "").trim(),
            mimeType: String(a?.mimeType || "").trim(),
          }))
          .filter((a) => a.url)
      : [];

    const msg = await CommunicationMessage.create({
      hospital: channel.hospital,
      channel: channel._id,
      sender: req.user._id,
      senderRole: actorRole(req),
      body,
      attachments,
    });

    channel.updatedBy = req.user._id;
    await channel.save();

    await writeAudit(req, "COMM_MESSAGE_SENT", msg._id, {
      channelId: String(channel._id),
      bodyLength: body.length,
    });

    const payload = await CommunicationMessage.findById(msg._id)
      .populate("sender", "name role")
      .lean();

    try {
      const io = getIO();
      io.to(`channel:${String(channel._id)}`).emit("communication:message", payload);
    } catch {
      // Socket layer should never block API path.
    }

    return res.status(201).json({ success: true, message: payload });
  } catch (err) {
    return next(err);
  }
};
