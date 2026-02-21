import Appointment from '../models/Appointment.js';
import { predictNextAvailableSlot, simpleRiskScore } from '../utils/aiUtils.js';
import { extractDocumentBase64 } from "../services/aiAdapter.js";
import { logAudit } from "../services/auditService.js";

export const suggestSlot = async (req, res, next) => {
  try {
    const { hospital, doctor, date } = req.query;
    const day = date ? new Date(date) : new Date();
    const appointments = await Appointment.find({ hospital, doctor, scheduledAt: { $gte: new Date(day.setHours(0,0,0,0)), $lt: new Date(new Date(day).setDate(day.getDate()+1)) } });
    const slot = predictNextAvailableSlot(appointments, date ? new Date(date) : new Date());
    res.json({ suggested: slot });
  } catch (err) { next(err); }
};

export const patientRisk = async (req, res, next) => {
  try {
    const patient = req.body;
    const score = simpleRiskScore(patient);
    res.json({ score });
  } catch (err) { next(err); }
};

export const extractDocument = async (req, res, next) => {
  try {
    const file = req.file;
    if (!file?.buffer) {
      return res.status(400).json({ message: "No uploaded file provided" });
    }

    const contentBase64 = file.buffer.toString("base64");
    const extraction = await extractDocumentBase64({
      contentBase64,
      mimeType: file.mimetype,
      filename: file.originalname,
    });

    await logAudit({
      actorId: req.user?._id,
      actorRole: req.user?.role,
      action: "AI_DOCUMENT_EXTRACTED",
      resource: "ai_document",
      hospital: req.user?.hospital || req.user?.hospitalId || null,
      after: {
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        provider: extraction?.provider || "unknown",
      },
      ip: req.ip,
      userAgent: req.get?.("user-agent"),
    });

    return res.json({
      ok: true,
      filename: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      extraction,
    });
  } catch (err) {
    next(err);
  }
};
