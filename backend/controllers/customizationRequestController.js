import CustomizationRequest from "../models/CustomizationRequest.js";
import { normalizeRole } from "../utils/normalizeRole.js";

const PRIVILEGED = new Set(["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"]);
const REQUESTER_ROLES = new Set(["HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUPER_ADMIN", "DEVELOPER"]);

function roleOf(req) {
  return normalizeRole(req.user?.actualRole || req.user?.role || "");
}

export async function createCustomizationRequest(req, res, next) {
  try {
    const role = roleOf(req);
    if (!REQUESTER_ROLES.has(role)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const title = String(req.body?.title || "").trim();
    const requirements = String(req.body?.requirements || "").trim();
    if (!title || !requirements) {
      return res.status(422).json({ message: "title and requirements are required" });
    }

    const requested = await CustomizationRequest.create({
      requester: req.user?._id,
      hospital: req.user?.hospitalId || req.user?.hospital || null,
      scope: req.body?.scope || "HOSPITAL",
      country: String(req.body?.country || "").trim().toUpperCase() || undefined,
      title,
      requirements,
      requestedModules: Array.isArray(req.body?.requestedModules)
        ? req.body.requestedModules.map((m) => String(m).trim()).filter(Boolean)
        : [],
      exclusiveDeployment: Boolean(req.body?.exclusiveDeployment),
      desiredGoLiveDate: req.body?.desiredGoLiveDate ? new Date(req.body.desiredGoLiveDate) : undefined,
      status: "OPEN",
    });

    const hydrated = await CustomizationRequest.findById(requested._id)
      .populate("requester", "name role email")
      .lean();
    return res.status(201).json({ success: true, request: hydrated });
  } catch (err) {
    return next(err);
  }
}

export async function listCustomizationRequests(req, res, next) {
  try {
    const role = roleOf(req);
    const filter = {};
    if (!PRIVILEGED.has(role)) {
      filter.hospital = req.user?.hospitalId || req.user?.hospital || null;
    } else {
      if (req.query.hospitalId) filter.hospital = req.query.hospitalId;
      if (req.query.scope) filter.scope = req.query.scope;
      if (req.query.status) filter.status = req.query.status;
    }

    const rows = await CustomizationRequest.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .populate("requester", "name role email")
      .populate("reviewedBy", "name role")
      .lean();

    return res.json({ success: true, items: rows });
  } catch (err) {
    return next(err);
  }
}

export async function updateCustomizationRequestStatus(req, res, next) {
  try {
    const role = roleOf(req);
    if (!PRIVILEGED.has(role)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const request = await CustomizationRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: "Request not found" });

    if (req.body?.status !== undefined) request.status = req.body.status;
    if (req.body?.reviewNotes !== undefined) request.reviewNotes = String(req.body.reviewNotes || "").trim();
    request.reviewedBy = req.user?._id || null;
    await request.save();

    const hydrated = await CustomizationRequest.findById(request._id)
      .populate("requester", "name role email")
      .populate("reviewedBy", "name role")
      .lean();
    return res.json({ success: true, request: hydrated });
  } catch (err) {
    return next(err);
  }
}

