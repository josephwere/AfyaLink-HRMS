import { v4 as uuidv4 } from "uuid";
import { redis } from "../utils/redis.js";
import { audit } from "../utils/audit.js";
import EmergencySession from "../models/EmergencySession.js";
import EmergencyReview from "../models/EmergencyReview.js";
import { sendEmail } from "../utils/mailer.js";
import { sendSMS } from "../services/notificationService.js";

const DEFAULT_TTL_MIN = 15; // minutes

export async function activateEmergency(req, res) {
  try {
    const { reason, durationMinutes } = req.body || {};
    if (!reason || String(reason || "").trim().length < 5) {
      return res.status(400).json({ error: "A short reason is required for emergency activation" });
    }

    const ttlMinutes = Number(durationMinutes) || DEFAULT_TTL_MIN;
    const token = uuidv4();
    const key = `emergency:${token}`;
    const payload = {
      actorId: String(req.user._id),
      actorRole: req.user.role,
      hospitalId: req.user.hospitalId || req.user.hospital || null,
      reason: String(reason || "").trim(),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString(),
    };

    await redis.set(key, JSON.stringify(payload), { ex: Math.max(60, Math.floor(ttlMinutes * 60)) });

    // persist session for governance
    const session = await EmergencySession.create({
      token,
      actorId: req.user._id,
      actorRole: req.user.role,
      hospitalId: payload.hospitalId,
      reason: payload.reason,
      createdAt: new Date(payload.createdAt),
      expiresAt: new Date(payload.expiresAt),
      active: true,
    });

    await audit({
      req,
      action: "BREAK_GLASS_ACTIVATED",
      resource: "EmergencyOverride",
      resourceId: String(session._id),
      metadata: { ...payload, sessionId: String(session._id) },
    });

    // notify supervisors (non-blocking)
    try {
      // send to hospital admins in same hospital
      const Hospital = (await import("../models/Hospital.js")).default;
      const User = (await import("../models/User.js")).default;
      const hospital = payload.hospitalId ? await Hospital.findById(payload.hospitalId).lean() : null;
      const admins = await User.find({ role: "HOSPITAL_ADMIN", hospital: payload.hospitalId, active: true }).select("email phone name");
      const message = `Emergency access activated by ${req.user.name} (${req.user.role}) for hospital ${hospital?.name || payload.hospitalId}: ${payload.reason}`;
      for (const a of admins) {
        if (a.email) sendEmail({ to: a.email, subject: "Emergency Access Activated", text: message }).catch(() => {});
        if (a.phone) sendSMS({ to: a.phone, message }).catch(() => {});
      }
    } catch (e) {
      console.error("notify supervisors failed:", e?.message || e);
    }

    return res.status(201).json({ token, expiresAt: payload.expiresAt, sessionId: String(session._id) });
  } catch (err) {
    console.error("activateEmergency error:", err.message);
    return res.status(500).json({ error: "Activation failed" });
  }
}
export async function deactivateEmergency(req, res) {
  try {
    const token = req.body?.token || req.headers["x-emergency-token"] || req.headers["x-break-glass-token"];
    if (!token) return res.status(400).json({ error: "token required" });
    const key = `emergency:${token}`;
    const raw = await redis.get(key);
    if (!raw) return res.status(404).json({ error: "Not found or already expired" });
    const payload = typeof raw === "string" ? JSON.parse(raw) : raw;

    // allow deactivation by actor or super admin
    const allowed = String(req.user._id) === String(payload.actorId) || (req.user.role || "").toUpperCase() === "SUPER_ADMIN";
    if (!allowed) return res.status(403).json({ error: "Forbidden" });

    await redis.del(key);

    // mark persisted session inactive if exists
    try {
      const session = await EmergencySession.findOneAndUpdate({ token }, { active: false, deactivatedAt: new Date(), deactivatedBy: req.user._id }, { new: true }).exec();
      await audit({
        req,
        action: "BREAK_GLASS_DEACTIVATED",
        resource: "EmergencyOverride",
        resourceId: session ? String(session._id) : null,
        metadata: { token, actorId: payload.actorId, actorRole: payload.actorRole },
      });
    } catch (e) {
      await audit({
        req,
        action: "BREAK_GLASS_DEACTIVATED",
        resource: "EmergencyOverride",
        resourceId: null,
        metadata: { token, actorId: payload.actorId, actorRole: payload.actorRole },
      });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("deactivateEmergency error:", err.message);
    return res.status(500).json({ error: "Deactivation failed" });
  }
}

export async function listSessions(req, res) {
  try {
    const role = (req.user.role || "").toUpperCase();
    const filter = {};
    if (role === "HOSPITAL_ADMIN") {
      filter.hospitalId = req.user.hospital || req.user.hospitalId;
    }
    const sessions = await EmergencySession.find(filter).sort({ createdAt: -1 }).lean();
    return res.json({ items: sessions });
  } catch (err) {
    console.error("listSessions error:", err.message);
    return res.status(500).json({ error: "Failed" });
  }
}

export async function getSession(req, res) {
  try {
    const id = req.params.id;
    const session = await EmergencySession.findById(id).lean();
    if (!session) return res.status(404).json({ error: "Not found" });
    const reviews = await EmergencyReview.find({ session: session._id }).populate("reviewer", "name email role").sort({ createdAt: -1 }).lean();
    return res.json({ data: { session, reviews } });
  } catch (err) {
    console.error("getSession error:", err.message);
    return res.status(500).json({ error: "Failed" });
  }
}

export async function reviewSession(req, res) {
  try {
    const { id } = req.params;
    const { status, notes } = req.body || {};
    if (!["APPROVED", "REJECTED"].includes(status)) return res.status(400).json({ error: "Invalid status" });
    if (!notes || String(notes || "").trim().length < 3) return res.status(400).json({ error: "Reviewer notes required" });

    const session = await EmergencySession.findById(id);
    if (!session) return res.status(404).json({ error: "Not found" });

    const review = await EmergencyReview.create({ session: session._id, reviewer: req.user._id, status, notes });

    session.reviewStatus = status;
    session.reviewedAt = new Date();
    session.reviewedBy = req.user._id;
    await session.save();

    // audit the review action
    await audit({
      req,
      action: "BREAK_GLASS_REVIEWED",
      resource: "EmergencyOverride",
      resourceId: String(session._id),
      metadata: { reviewStatus: status, reviewerNotes: notes },
    });

    // notify original actor
    try {
      const User = (await import("../models/User.js")).default;
      const actor = await User.findById(session.actorId).select("email phone name").lean();
      const message = `Your emergency access request (id=${String(session._id)}) has been reviewed: ${status}. Notes: ${notes}`;
      if (actor?.email) sendEmail({ to: actor.email, subject: "Emergency Access Reviewed", text: message }).catch(() => {});
      if (actor?.phone) sendSMS({ to: actor.phone, message }).catch(() => {});
    } catch (e) {
      console.error("notify actor failed:", e?.message || e);
    }

    return res.json({ data: review });
  } catch (err) {
    console.error("reviewSession error:", err.message);
    return res.status(500).json({ error: "Failed" });
  }
}
