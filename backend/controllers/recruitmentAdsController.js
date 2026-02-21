import RecruitmentAd from "../models/RecruitmentAd.js";
import RecruitmentApplication from "../models/RecruitmentApplication.js";
import User from "../models/User.js";
import { normalizeRole } from "../utils/normalizeRole.js";

export const createRecruitmentAd = async (req, res, next) => {
  try {
    const hospital = req.user?.hospital || req.user?.hospitalId;
    if (!hospital) return res.status(400).json({ message: "Hospital context required" });

    const body = req.body || {};
    if (!body.title || !body.description) {
      return res.status(400).json({ message: "title and description are required" });
    }

    const ad = await RecruitmentAd.create({
      hospital,
      createdBy: req.user.id,
      title: String(body.title).trim(),
      role: body.role ? String(body.role).trim() : "",
      department: body.department ? String(body.department).trim() : "",
      employmentType: body.employmentType ? String(body.employmentType).trim() : "",
      location: body.location ? String(body.location).trim() : "",
      salaryRange: body.salaryRange ? String(body.salaryRange).trim() : "",
      description: String(body.description).trim(),
      requirements: Array.isArray(body.requirements)
        ? body.requirements.map((r) => String(r).trim()).filter(Boolean)
        : String(body.requirements || "")
            .split("\n")
            .map((r) => r.trim())
            .filter(Boolean),
      contactEmail: body.contactEmail ? String(body.contactEmail).trim().toLowerCase() : "",
      contactPhone: body.contactPhone ? String(body.contactPhone).trim() : "",
      applyUrl: body.applyUrl ? String(body.applyUrl).trim() : "",
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      status: "ACTIVE",
    });

    return res.status(201).json({ success: true, ad });
  } catch (err) {
    return next(err);
  }
};

export const listRecruitmentAds = async (req, res, next) => {
  try {
    const role = normalizeRole(req.user?.role);
    const q = String(req.query.q || "").trim();
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);

    const filter = {};
    const andFilters = [];

    if (["PATIENT", "GUEST"].includes(role)) {
      filter.status = "ACTIVE";
      andFilters.push({
        $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: new Date() } }],
      });
      if (req.query.hospitalId) filter.hospital = req.query.hospitalId;
    } else {
      const actorHospital = req.user?.hospital || req.user?.hospitalId;
      const privileged = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role);
      if (!privileged) filter.hospital = actorHospital;
      else if (req.query.hospitalId) filter.hospital = req.query.hospitalId;
      if (req.query.status) filter.status = String(req.query.status).toUpperCase();
    }

    if (q) {
      andFilters.push({
        $or: [
        { title: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { department: { $regex: q, $options: "i" } },
        { location: { $regex: q, $options: "i" } },
        ],
      });
    }

    if (andFilters.length) {
      filter.$and = andFilters;
    }

    const [items, total] = await Promise.all([
      RecruitmentAd.find(filter)
        .populate("hospital", "name code")
        .populate("createdBy", "name email")
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      RecruitmentAd.countDocuments(filter),
    ]);

    return res.json({ items, total, page, limit });
  } catch (err) {
    return next(err);
  }
};

export const updateRecruitmentAd = async (req, res, next) => {
  try {
    const role = normalizeRole(req.user?.role);
    const privileged = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role);
    const actorHospital = req.user?.hospital || req.user?.hospitalId;

    const ad = await RecruitmentAd.findById(req.params.id);
    if (!ad) return res.status(404).json({ message: "Ad not found" });

    if (!privileged && String(ad.hospital) !== String(actorHospital)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const body = req.body || {};
    const fields = [
      "title",
      "role",
      "department",
      "employmentType",
      "location",
      "salaryRange",
      "description",
      "contactEmail",
      "contactPhone",
      "applyUrl",
      "status",
    ];
    fields.forEach((k) => {
      if (body[k] !== undefined) ad[k] = body[k];
    });
    if (body.expiresAt !== undefined) ad.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    if (body.requirements !== undefined) {
      ad.requirements = Array.isArray(body.requirements)
        ? body.requirements.map((r) => String(r).trim()).filter(Boolean)
        : String(body.requirements || "")
            .split("\n")
            .map((r) => r.trim())
            .filter(Boolean);
    }

    await ad.save();
    return res.json({ success: true, ad });
  } catch (err) {
    return next(err);
  }
};

export const applyToRecruitmentAd = async (req, res, next) => {
  try {
    const ad = await RecruitmentAd.findById(req.params.id).lean();
    if (!ad) return res.status(404).json({ message: "Ad not found" });

    if (ad.status !== "ACTIVE") {
      return res.status(400).json({ message: "This vacancy is no longer accepting applications" });
    }
    if (ad.expiresAt && new Date(ad.expiresAt) <= new Date()) {
      return res.status(400).json({ message: "This vacancy has expired" });
    }

    const actor = await User.findById(req.user.id).select("name email phone role nationalIdNumber").lean();
    if (!actor) return res.status(404).json({ message: "Applicant not found" });

    const body = req.body || {};

    const app = await RecruitmentApplication.create({
      ad: ad._id,
      hospital: ad.hospital,
      applicant: req.user.id,
      applicantRole: normalizeRole(actor.role),
      fullName: body.fullName ? String(body.fullName).trim() : actor.name,
      email: body.email ? String(body.email).trim().toLowerCase() : actor.email,
      phone: body.phone ? String(body.phone).trim() : actor.phone,
      coverLetter: body.coverLetter ? String(body.coverLetter).trim() : "",
      resumeUrl: body.resumeUrl ? String(body.resumeUrl).trim() : "",
      experienceSummary: body.experienceSummary ? String(body.experienceSummary).trim() : "",
      metadata: {
        nationalIdNumber: actor.nationalIdNumber || "",
      },
    });

    return res.status(201).json({ success: true, application: app });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: "You already applied to this vacancy" });
    }
    return next(err);
  }
};

export const listRecruitmentApplications = async (req, res, next) => {
  try {
    const role = normalizeRole(req.user?.role);
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
    const q = String(req.query.q || "").trim();
    const filter = {};

    const privileged = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role);
    const canManageHospital = ["HOSPITAL_ADMIN", "HR_MANAGER", ...["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"]].includes(role);

    if (req.query.mine === "1" || !canManageHospital) {
      filter.applicant = req.user.id;
    } else if (!privileged) {
      filter.hospital = req.user.hospital || req.user.hospitalId;
    } else if (req.query.hospitalId) {
      filter.hospital = req.query.hospitalId;
    }

    if (req.query.adId) filter.ad = req.query.adId;
    if (req.query.status) filter.status = String(req.query.status).toUpperCase();

    if (q) {
      filter.$or = [
        { fullName: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
      ];
    }

    const [items, total] = await Promise.all([
      RecruitmentApplication.find(filter)
        .populate("ad", "title role department status")
        .populate("hospital", "name code")
        .populate("applicant", "name email role")
        .populate("reviewedBy", "name email")
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      RecruitmentApplication.countDocuments(filter),
    ]);

    return res.json({ items, total, page, limit });
  } catch (err) {
    return next(err);
  }
};

export const updateRecruitmentApplicationStatus = async (req, res, next) => {
  try {
    const role = normalizeRole(req.user?.role);
    const privileged = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role);
    const actorHospital = req.user.hospital || req.user.hospitalId;

    const app = await RecruitmentApplication.findById(req.params.applicationId);
    if (!app) return res.status(404).json({ message: "Application not found" });

    if (!privileged && String(app.hospital) !== String(actorHospital)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const nextStatus = String(req.body?.status || "").toUpperCase();
    const allowed = ["NEW", "UNDER_REVIEW", "SHORTLISTED", "REJECTED", "HIRED"];
    if (!allowed.includes(nextStatus)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    app.status = nextStatus;
    app.reviewedBy = req.user.id;
    app.reviewedAt = new Date();
    app.reviewNote = req.body?.reviewNote ? String(req.body.reviewNote).trim() : app.reviewNote;
    await app.save();

    return res.json({ success: true, application: app });
  } catch (err) {
    return next(err);
  }
};
