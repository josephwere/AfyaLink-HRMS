import User from "../models/User.js";
import { denyAudit } from "../middleware/denyAudit.js";
import { audit } from "../utils/audit.js";
import Hospital from "../models/Hospital.js";
import RegisteredPharmacy from "../models/RegisteredPharmacy.js";
import { encodeCursor, decodeCursor } from "../utils/cursor.js";
import { normalizeRole } from "../utils/normalizeRole.js";
import { HOSPITAL_SCOPED_ROLES, STAFF_ROLES } from "../utils/roleSets.js";
import { collectPharmacyLinkBackfillPreview } from "../services/pharmacyLinkBackfillService.js";

const ALL_ASSIGNABLE_ROLES = new Set([
  "SUPER_ADMIN",
  "SYSTEM_ADMIN",
  "HOSPITAL_ADMIN",
  "HOSPITAL_ADMIN_ASSISTANT",
  "DEVELOPER",
  "DOCTOR",
  "SURGEON",
  "NURSE",
  "LAB_TECH",
  "PHARMACIST",
  "RADIOLOGIST",
  "THERAPIST",
  "RECEPTIONIST",
  "SECURITY_OFFICER",
  "SECURITY_ADMIN",
  "HR_MANAGER",
  "PAYROLL_OFFICER",
  "COMMUNITY_HEALTH_WORKER",
  "GOVERNMENT_ADMIN",
  "GOVERNMENT_REGULATOR",
  "GOVERNMENT_AUDITOR",
  "GOVERNMENT_INSPECTOR",
  "GOVERNMENT_ANALYST",
  "PATIENT",
  "GUEST",
]);

const HOSPITAL_ADMIN_ASSIGNABLE_ROLES = new Set([
  "HOSPITAL_ADMIN",
  "HOSPITAL_ADMIN_ASSISTANT",
  "DOCTOR",
  "SURGEON",
  "NURSE",
  "LAB_TECH",
  "PHARMACIST",
  "RADIOLOGIST",
  "THERAPIST",
  "RECEPTIONIST",
  "SECURITY_OFFICER",
  "SECURITY_ADMIN",
  "HR_MANAGER",
  "PAYROLL_OFFICER",
  "COMMUNITY_HEALTH_WORKER",
  "PATIENT",
  "GUEST",
]);

const HOSPITAL_SCOPED_ROLES_SET = new Set(HOSPITAL_SCOPED_ROLES);
const STAFF_ROLES_SET = new Set(STAFF_ROLES);

/**
 * POST /api/users
 * CREATE USER (STAFF LIMIT ENFORCED)
 */
export const createUser = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    const hospitalId = req.user.hospitalId;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const STAFF_ROLES = [
      "HOSPITAL_ADMIN",
      "HOSPITAL_ADMIN_ASSISTANT",
      "DOCTOR",
      "SURGEON",
      "NURSE",
      "LAB_TECH",
      "PHARMACIST",
      "RADIOLOGIST",
      "THERAPIST",
      "RECEPTIONIST",
      "SECURITY_OFFICER",
      "SECURITY_ADMIN",
      "HR_MANAGER",
      "PAYROLL_OFFICER",
      "COMMUNITY_HEALTH_WORKER",
    ];

    const isStaff = STAFF_ROLES.includes(role);

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ message: "Email already in use" });
    }

    /* ================= STAFF LIMIT ================= */
    if (isStaff) {
      const hospital = await Hospital.findOne({
        _id: hospitalId,
        active: true,
      }).select("limits");

      if (!hospital) {
        return res.status(403).json({
          message: "Hospital inactive or not found",
        });
      }

      const staffCount = await User.countDocuments({
        hospital: hospitalId,
        active: true,
        role: { $in: STAFF_ROLES },
      });

      if (staffCount >= hospital.limits.users) {
        await denyAudit(req, res, "Staff limit exceeded");

        return res.status(403).json({
          message:
            "Staff limit reached. Upgrade plan to add more users.",
        });
      }
    }

    /* ================= CREATE ================= */
    const user = await User.create({
      name,
      email,
      password,
      role,
      hospital: hospitalId,
      active: true,
    });

    await audit({
      req,
      action: "CREATE_USER",
      resource: "User",
      resourceId: user._id,
      metadata: { role },
    });

    res.status(201).json({
      message: "User created successfully",
      userId: user._id,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/users/me
 * Logged-in user profile
 */
export const getMe = async (req, res, next) => {
  try {
    if (!req.user.active) {
      return res.status(403).json({
        message: "Account inactive",
      });
    }

    res.json(req.user);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/users
 * List ACTIVE users within SAME hospital only
 */
export const listUsers = async (req, res, next) => {
  try {
    if (String(req.query.groupByHospital || "") === "1") {
      const actorRole = String(req.user?.role || "").toUpperCase();
      if (!["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(actorRole)) {
        return res.status(403).json({ message: "Only global admins can group users by hospital" });
      }
      const grouped = await User.aggregate([
        {
          $group: {
            _id: { hospital: "$hospital", role: "$role" },
            count: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: "hospitals",
            localField: "_id.hospital",
            foreignField: "_id",
            as: "hospitalRef",
          },
        },
        {
          $project: {
            _id: 0,
            hospitalId: "$_id.hospital",
            hospitalName: {
              $ifNull: [{ $arrayElemAt: ["$hospitalRef.name", 0] }, "UNASSIGNED"],
            },
            role: "$_id.role",
            count: 1,
          },
        },
        {
          $sort: { hospitalName: 1, role: 1 },
        },
      ]);
      return res.json({ items: grouped });
    }

    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "25", 10), 1), 100);
    const cursor = req.query.cursor || null;
    const q = (req.query.q || "").trim();

    const actorRole = String(req.user?.role || "").toUpperCase();
    const isGlobalAdmin = actorRole === "SUPER_ADMIN" || actorRole === "SYSTEM_ADMIN";
    const filter = {
      active: req.query.includeInactive === "1" ? { $in: [true, false] } : true,
    };

    if (isGlobalAdmin) {
      if (req.query.hospital) {
        filter.hospital = req.query.hospital;
      }
    } else {
      filter.hospital = req.user.hospitalId; // 🔐 tenant scoped for hospital users
    }

    const roleFilter = String(req.query.role || "").trim().toUpperCase();
    if (roleFilter) filter.role = roleFilter;
    if (String(req.query.missingRegisteredPharmacy || "") === "1") {
      filter.role = "PHARMACIST";
      filter.registeredPharmacy = null;
    }

    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
        { nationalIdNumber: { $regex: q, $options: "i" } },
        { role: { $regex: q, $options: "i" } },
      ];
    }

    if (cursor) {
      const parsed = decodeCursor(cursor);
      if (!parsed?.createdAt || !parsed?._id) {
        return res.status(400).json({ message: "Invalid cursor" });
      }
      filter.$and = [
        {
          $or: [
            { createdAt: { $lt: new Date(parsed.createdAt) } },
            { createdAt: new Date(parsed.createdAt), _id: { $lt: parsed._id } },
          ],
        },
      ];

      const rows = await User.find(filter)
        .select("-password")
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit + 1)
        .lean();
      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      const last = items[items.length - 1];
      const nextCursor = hasMore && last
        ? encodeCursor({ createdAt: last.createdAt, _id: last._id })
        : null;
      return res.json({ items, nextCursor, hasMore, limit });
    }

    const [items, total] = await Promise.all([
      User.find(filter)
        .select("-password")
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    res.json({ items, total, page, limit });
  } catch (err) {
    next(err);
  }
};

export const getPharmacyLinkBackfillPreview = async (req, res, next) => {
  try {
    const actorRole = String(req.user?.role || "").toUpperCase();
    if (!["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(actorRole)) {
      return res.status(403).json({ message: "Only global admins can preview pharmacy backfill results" });
    }

    const preview = await collectPharmacyLinkBackfillPreview();
    return res.json({
      summary: {
        scanned: preview.scanned,
        matched: preview.matched.length,
        ambiguous: preview.ambiguous.length,
        skipped: preview.skipped.length,
      },
      matched: preview.matched,
      ambiguous: preview.ambiguous,
      skipped: preview.skipped,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/users/:id
 * Update user (same hospital only, active only)
 */
export const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };
    const actorRole = normalizeRole(String(req.user?.actualRole || req.user?.role || ""));
    const isGlobalAdmin =
      actorRole === "SUPER_ADMIN" ||
      actorRole === "SYSTEM_ADMIN" ||
      actorRole === "DEVELOPER";

    // 🔐 Password changes handled elsewhere
    delete updates.password;
    // allow active status update for admin deactivation

    const user = await User.findById(id);
    const previousRole = normalizeRole(String(user?.role || ""));
    const previousRegisteredPharmacy = user?.registeredPharmacy ? String(user.registeredPharmacy) : null;

    if (!user || !user.active) {
      return res.status(404).json({ message: "User not found" });
    }

    // 🔐 TENANT ISOLATION (CRITICAL)
    if (
      !isGlobalAdmin &&
      user.hospital?.toString() !== req.user.hospitalId?.toString()
    ) {
      await denyAudit(
        req,
        res,
        "Cross-hospital user update blocked"
      );

      return res.status(403).json({
        message: "Access denied",
      });
    }

    // Protected accounts cannot be role-escalated/deactivated by non-super-admin actors.
    if (user.protectedAccount && actorRole !== "SUPER_ADMIN") {
      return res.status(403).json({ message: "Protected account can only be modified by Super Admin" });
    }

    const roleRequested = Object.prototype.hasOwnProperty.call(updates, "role");
    if (roleRequested) {
      const nextRole = normalizeRole(updates.role);
      if (!ALL_ASSIGNABLE_ROLES.has(nextRole)) {
        return res.status(400).json({ message: "Invalid target role" });
      }

      // HR managers can update profile fields, but not role escalation.
      if (actorRole === "HR_MANAGER") {
        return res.status(403).json({ message: "HR Manager cannot change user roles" });
      }

      if (actorRole === "HOSPITAL_ADMIN" || actorRole === "HOSPITAL_ADMIN_ASSISTANT") {
        if (!HOSPITAL_ADMIN_ASSIGNABLE_ROLES.has(nextRole)) {
          return res.status(403).json({ message: "Hospital admin scope cannot assign this role" });
        }
      } else if (!isGlobalAdmin) {
        return res.status(403).json({ message: "You are not allowed to change roles" });
      }

      updates.role = nextRole;

      // Hospital-scoped role changes must remain within actor's hospital context.
      if ((actorRole === "HOSPITAL_ADMIN" || actorRole === "HOSPITAL_ADMIN_ASSISTANT") && HOSPITAL_SCOPED_ROLES_SET.has(nextRole)) {
        const actorHospital = req.user.hospitalId || req.user.hospital;
        if (!actorHospital) {
          return res.status(400).json({ message: "Hospital context missing for role assignment" });
        }
        if (user.hospital && String(user.hospital) !== String(actorHospital)) {
          return res.status(403).json({ message: "Cannot assign role across hospitals" });
        }
        updates.hospital = actorHospital;
      }

      // Global actor may explicitly target hospital during assignment.
      if (isGlobalAdmin && req.body?.hospital) {
        updates.hospital = req.body.hospital;
      }

      if (isGlobalAdmin && HOSPITAL_SCOPED_ROLES_SET.has(nextRole)) {
        const targetHospital = updates.hospital || user.hospital || null;
        if (!targetHospital) {
          return res.status(400).json({
            message: "Hospital is required when assigning hospital-scoped roles",
          });
        }
        updates.hospital = targetHospital;
      }

      // If assigning non hospital-scoped role, clear hospital unless explicit override provided.
      if (!HOSPITAL_SCOPED_ROLES_SET.has(nextRole) && updates.hospital === undefined) {
        if (!["PATIENT", "GUEST"].includes(nextRole)) {
          updates.hospital = null;
        }
      }

      if (nextRole !== "PHARMACIST" && updates.registeredPharmacy === undefined) {
        updates.registeredPharmacy = null;
      }

      if (HOSPITAL_SCOPED_ROLES_SET.has(nextRole)) {
        updates.employment = {
          ...(user.employment || {}),
          ...(updates.employment || {}),
          status: "ACTIVE",
          separationDate: undefined,
          separationReason: undefined,
          transferRequest: undefined,
        };
      } else if (nextRole === "PATIENT" || nextRole === "GUEST") {
        updates.employment = {
          ...(user.employment || {}),
          ...(updates.employment || {}),
          status: "INACTIVE",
          separationDate: new Date(),
          transferRequest: undefined,
        };
      }

      await audit({
        req,
        action: "CHANGE_USER_ROLE",
        resource: "User",
        resourceId: user._id,
        metadata: {
          fromRole: previousRole,
          toRole: nextRole,
          actorRole,
          actorHospital: req.user?.hospitalId || req.user?.hospital || null,
        },
      });
    } else {
      // No role change requested: prevent non-global actors from changing hospital ownership.
      if (!isGlobalAdmin) {
        delete updates.hospital;
      }
    }

    if (Object.prototype.hasOwnProperty.call(updates, "registeredPharmacy")) {
      const nextRole = normalizeRole(updates.role || user.role);
      if (nextRole !== "PHARMACIST") {
        updates.registeredPharmacy = null;
      } else if (updates.registeredPharmacy) {
        const pharmacy = await RegisteredPharmacy.findById(updates.registeredPharmacy).select("_id status").lean();
        if (!pharmacy || pharmacy.status !== "ACTIVE") {
          return res.status(422).json({ message: "Registered pharmacy not found or inactive" });
        }
      } else {
        updates.registeredPharmacy = null;
      }
    }

    Object.assign(user, updates);
    await user.save();

    const nextRegisteredPharmacy = user?.registeredPharmacy ? String(user.registeredPharmacy) : null;
    if (previousRegisteredPharmacy !== nextRegisteredPharmacy) {
      await audit({
        req,
        action: "PHARMACIST_LINKAGE_UPDATE",
        resource: "User",
        resourceId: user._id,
        before: {
          role: previousRole,
          registeredPharmacy: previousRegisteredPharmacy,
        },
        after: {
          role: normalizeRole(String(user.role || "")),
          registeredPharmacy: nextRegisteredPharmacy,
        },
        metadata: {
          actorRole,
          hospital: user.hospital || null,
          linked: Boolean(nextRegisteredPharmacy),
        },
      });
    }

    await audit({
      req,
      action: "UPDATE_USER",
      resource: "User",
      resourceId: user._id,
    });

    res.json(
      user.toObject({ getters: true, versionKey: false })
    );
  } catch (err) {
    next(err);
  }
};

export const demoteStaffToPatient = async (req, res, next) => {
  try {
    const { id } = req.params;
    const reason = String(req.body?.reason || "Employment ended").trim();
    const actorRole = normalizeRole(String(req.user?.actualRole || req.user?.role || ""));
    const isGlobalAdmin =
      actorRole === "SUPER_ADMIN" ||
      actorRole === "SYSTEM_ADMIN" ||
      actorRole === "DEVELOPER";

    if (actorRole === "HR_MANAGER") {
      return res.status(403).json({ message: "HR Manager cannot demote users to patient" });
    }

    const user = await User.findById(id);
    if (!user || !user.active) {
      return res.status(404).json({ message: "User not found" });
    }

    const targetRole = normalizeRole(String(user.role || ""));
    if (!HOSPITAL_SCOPED_ROLES_SET.has(targetRole) && !STAFF_ROLES_SET.has(targetRole)) {
      return res.status(400).json({ message: "Only hospital staff can be demoted to patient" });
    }

    if (
      !isGlobalAdmin &&
      String(user.hospital || "") !== String(req.user.hospitalId || req.user.hospital || "")
    ) {
      return res.status(403).json({ message: "Cannot modify staff outside your hospital" });
    }

    const previousRole = targetRole;
    const previousHospital = user.hospital;
    user.role = "PATIENT";
    user.hospital = null;
    user.employment = user.employment || {};
    user.employment.status = "INACTIVE";
    user.employment.separationDate = new Date();
    user.employment.separationReason = reason;
    user.employment.transferRequest = undefined;
    await user.save();

    await audit({
      req,
      action: "STAFF_DEMOTED_TO_PATIENT",
      resource: "User",
      resourceId: user._id,
      metadata: {
        fromRole: previousRole,
        toRole: "PATIENT",
        fromHospital: previousHospital || null,
        reason,
      },
    });

    return res.json({
      success: true,
      message: "Staff member demoted to patient",
      user: user.toObject({ getters: true, versionKey: false }),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DEACTIVATE USER (SOFT DELETE)
 * ✔ audit-safe
 * ✔ tenant-safe
 * ✔ reversible
 */
export const deactivateUser = async (req, res, next) => {
  try {
    // 🚫 Prevent self-deactivation
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({
        message: "You cannot deactivate your own account",
      });
    }

    const user = await User.findOneAndUpdate(
      {
        _id: req.params.id,
        hospital: req.user.hospitalId, // 🔐 tenant scoped
        active: true,
      },
      { active: false },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await audit({
      req,
      action: "DEACTIVATE_USER",
      resource: "User",
      resourceId: user._id,
    });

    res.json({
      message: "User deactivated",
    });
  } catch (err) {
    next(err);
  }
};
