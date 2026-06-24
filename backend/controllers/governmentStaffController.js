import User from "../models/User.js";
import GovernmentStaff, { GOVERNMENT_STAFF_ROLES } from "../models/GovernmentStaff.js";
import { audit } from "../utils/audit.js";

const GOVERNMENT_STAFF_ROLES_SET = new Set(GOVERNMENT_STAFF_ROLES);
const GLOBAL_CREATORS = new Set(["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"]);
const GOVERNMENT_ADMIN_ASSIGNABLE = new Set(
  GOVERNMENT_STAFF_ROLES.filter((role) => role !== "GOVERNMENT_ADMIN")
);

function actorRole(req) {
  return String(req.user?.actualRole || req.user?.role || "").toUpperCase();
}

function normalizeGovernmentRole(role) {
  const normalized = String(role || "").trim().toUpperCase();
  if (normalized === "REGULATOR") return "GOVERNMENT_REGULATOR";
  if (normalized === "AUDITOR") return "GOVERNMENT_AUDITOR";
  if (normalized === "INSPECTOR") return "GOVERNMENT_INSPECTOR";
  if (normalized === "ANALYST") return "GOVERNMENT_ANALYST";
  if (normalized === "ADMIN") return "GOVERNMENT_ADMIN";
  return normalized;
}

function canCreateRole(req, role) {
  const actor = actorRole(req);
  if (GLOBAL_CREATORS.has(actor)) return true;
  if (actor === "GOVERNMENT_ADMIN") return GOVERNMENT_ADMIN_ASSIGNABLE.has(role);
  return false;
}

async function upsertGovernmentProfile(user, payload = {}, req = null) {
  return GovernmentStaff.findOneAndUpdate(
    { user: user._id },
    {
      $set: {
        user: user._id,
        role: user.role,
        agency: String(payload.agency || "Ministry of Health").trim(),
        department: String(payload.department || "").trim(),
        title: String(payload.title || "").trim(),
        employeeId: String(payload.employeeId || user?.employment?.employeeId || "").trim(),
        jurisdiction: {
          country: String(payload.country || payload?.jurisdiction?.country || "KE").trim().toUpperCase(),
          region: String(payload.region || payload?.jurisdiction?.region || "").trim(),
          county: String(payload.county || payload?.jurisdiction?.county || "").trim(),
        },
        status: payload.status ? String(payload.status).trim().toUpperCase() : "ACTIVE",
        createdBy: req?.user?._id || null,
        metadata: {
          ...(payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {}),
          source: payload.metadata?.source || "ADMIN_REGISTRATION",
        },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

export const registerGovernmentStaff = async (req, res, next) => {
  try {
    const {
      name,
      email,
      password,
      role,
      phone,
      agency,
      department,
      title,
      employeeId,
      country,
      region,
      county,
    } = req.body || {};

    const normalizedRole = normalizeGovernmentRole(role);
    if (!name || !email || !password || !GOVERNMENT_STAFF_ROLES_SET.has(normalizedRole)) {
      return res.status(400).json({
        message: "Name, email, password, and a valid government role are required.",
      });
    }

    if (!canCreateRole(req, normalizedRole)) {
      return res.status(403).json({
        message:
          normalizedRole === "GOVERNMENT_ADMIN"
            ? "Only founder, system admin, or developer can create a government admin."
            : "Only government admin or global admin can create government staff.",
      });
    }

    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (await User.findOne({ email: normalizedEmail }).select("_id").lean()) {
      return res.status(409).json({ message: "Email already exists" });
    }

    const user = await User.create({
      name: String(name || "").trim(),
      email: normalizedEmail,
      password,
      passwordSetAt: new Date(),
      phone: phone ? String(phone).trim() : undefined,
      role: normalizedRole,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      phoneVerified: Boolean(phone),
      phoneVerifiedAt: phone ? new Date() : undefined,
      protectedAccount: normalizedRole === "GOVERNMENT_ADMIN",
      twoFactorEnabled: false,
      active: true,
      employment: {
        employeeId: employeeId ? String(employeeId).trim() : undefined,
        department: department ? String(department).trim() : undefined,
        status: "ACTIVE",
      },
      metadata: {
        governmentAccount: true,
      },
    });

    const staff = await upsertGovernmentProfile(
      user,
      { agency, department, title, employeeId, country, region, county },
      req
    );

    await audit({
      req,
      action: "CREATE_GOVERNMENT_STAFF",
      resource: "User",
      resourceId: user._id,
      metadata: {
        role: normalizedRole,
        agency: staff.agency,
        jurisdiction: staff.jurisdiction,
      },
    });

    return res.status(201).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      governmentStaff: staff,
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: "Government staff profile already exists" });
    }
    return next(err);
  }
};

export const listGovernmentStaff = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "25", 10), 1), 100);
    const q = String(req.query.q || "").trim();
    const role = normalizeGovernmentRole(req.query.role || "");
    const filter = {};

    if (GOVERNMENT_STAFF_ROLES_SET.has(role)) filter.role = role;
    if (q) {
      filter.$or = [
        { agency: { $regex: q, $options: "i" } },
        { department: { $regex: q, $options: "i" } },
        { title: { $regex: q, $options: "i" } },
        { employeeId: { $regex: q, $options: "i" } },
      ];
    }

    const [items, total] = await Promise.all([
      GovernmentStaff.find(filter)
        .populate("user", "name email phone role active createdAt")
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      GovernmentStaff.countDocuments(filter),
    ]);

    return res.json({ items, total, page, limit });
  } catch (err) {
    return next(err);
  }
};
