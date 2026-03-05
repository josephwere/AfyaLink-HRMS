import mongoose from "mongoose";
import DelegatedPermission from "../models/DelegatedPermission.js";
import User from "../models/User.js";
import { normalizeRole } from "../utils/normalizeRole.js";
import { cacheDel } from "../utils/cache.js";
import { getMenuPermissionCatalog } from "../utils/menuCatalog.js";
import { logAudit } from "../services/auditService.js";

const HOSPITAL_WORKER_ROLES = [
  "DOCTOR",
  "SURGEON",
  "NURSE",
  "LAB_TECH",
  "PHARMACIST",
  "RADIOLOGIST",
  "THERAPIST",
  "RECEPTIONIST",
  "SECURITY_ADMIN",
  "SECURITY_OFFICER",
  "HR_MANAGER",
  "PAYROLL_OFFICER",
  "PATIENT",
  "GUEST",
];

const ROLE_MANAGEMENT_MATRIX = {
  SUPER_ADMIN: [
    "SYSTEM_ADMIN",
    "HOSPITAL_ADMIN",
    "DEVELOPER",
    ...HOSPITAL_WORKER_ROLES,
  ],
  SYSTEM_ADMIN: ["HOSPITAL_ADMIN"],
  HOSPITAL_ADMIN: HOSPITAL_WORKER_ROLES,
};

function currentActorRole(req) {
  return normalizeRole(req.user?.actualRole || req.user?.role || "");
}

function getManageableRoles(actorRole) {
  return ROLE_MANAGEMENT_MATRIX[actorRole] || [];
}

async function loadTargetUser(userId) {
  if (!mongoose.Types.ObjectId.isValid(userId)) return null;
  return User.findById(userId).select("_id role hospital name email").lean();
}

function canManageTarget(req, targetUser) {
  if (!req.user || !targetUser) return false;
  const actorRole = currentActorRole(req);
  const targetRole = normalizeRole(targetUser.role);
  const manageable = getManageableRoles(actorRole);
  if (!manageable.includes(targetRole)) return false;

  // Hospital Admin can only manage users inside their own hospital.
  if (actorRole === "HOSPITAL_ADMIN") {
    return String(req.user.hospital || "") === String(targetUser.hospital || "");
  }

  return true;
}

function getAssignablePermissionsForActor(actorRole) {
  const catalog = getMenuPermissionCatalog();
  if (actorRole === "HOSPITAL_ADMIN") {
    return catalog.filter((entry) => {
      const roles = entry.roles || [];
      if (roles.includes("SUPER_ADMIN")) return false;
      if (roles.includes("SYSTEM_ADMIN")) return false;
      if (roles.includes("DEVELOPER")) return false;
      return true;
    });
  }

  if (actorRole === "SYSTEM_ADMIN") {
    return catalog.filter((entry) => {
      const roles = entry.roles || [];
      return !roles.includes("SUPER_ADMIN");
    });
  }

  return catalog;
}

export const getDelegationScope = async (req, res) => {
  try {
    const actorRole = currentActorRole(req);
    const manageableRoles = getManageableRoles(actorRole);
    if (!manageableRoles.length) {
      return res.status(403).json({ message: "No delegation scope for this role" });
    }

    const q = String(req.query?.q || "").trim();
    const roleFilter = normalizeRole(String(req.query?.role || "").trim());
    const limit = Math.min(Math.max(Number(req.query?.limit || 30), 1), 100);

    const filter = {
      role: roleFilter && manageableRoles.includes(roleFilter)
        ? roleFilter
        : { $in: manageableRoles },
      active: { $ne: false },
    };

    if (actorRole === "HOSPITAL_ADMIN") {
      filter.hospital = req.user.hospital || null;
    } else if (req.query?.hospital && mongoose.Types.ObjectId.isValid(req.query.hospital)) {
      filter.hospital = req.query.hospital;
    }

    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
      ];
    }

    const users = await User.find(filter)
      .select("_id name email role hospital")
      .sort({ name: 1 })
      .limit(limit)
      .lean();

    const permissionsCatalog = getAssignablePermissionsForActor(actorRole);

    return res.json({
      actorRole,
      manageableRoles,
      users,
      permissionsCatalog,
    });
  } catch (err) {
    console.error("Delegation scope error:", err);
    return res.status(500).json({ message: "Failed to load delegation scope" });
  }
};

export const getUserDelegatedPermissions = async (req, res) => {
  try {
    const target = await loadTargetUser(req.params.userId);
    if (!target) return res.status(404).json({ message: "Target user not found" });
    if (!canManageTarget(req, target)) return res.status(403).json({ message: "Forbidden" });

    const grants = await DelegatedPermission.find({
      grantee: target._id,
      active: true,
      $or: [{ hospital: target.hospital || null }, { hospital: null }],
    })
      .select("permissionKey action effect grantedBy hospital updatedAt")
      .sort({ updatedAt: -1 })
      .lean();

    return res.json({
      target,
      grants,
    });
  } catch (err) {
    console.error("Delegation fetch error:", err);
    return res.status(500).json({ message: "Failed to load delegated permissions" });
  }
};

export const upsertUserDelegatedPermissions = async (req, res) => {
  try {
    const actorRole = currentActorRole(req);
    const target = await loadTargetUser(req.params.userId);
    if (!target) return res.status(404).json({ message: "Target user not found" });
    if (!canManageTarget(req, target)) return res.status(403).json({ message: "Forbidden" });

    const incoming = Array.isArray(req.body?.grants) ? req.body.grants : [];
    if (!incoming.length) {
      return res.status(400).json({ message: "grants array is required" });
    }

    const allowedPermissions = new Set(
      getAssignablePermissionsForActor(actorRole).map((row) => row.permissionKey)
    );

    const validRows = incoming
      .map((row) => ({
        permissionKey: String(row?.permissionKey || "").trim(),
        action: String(row?.action || "VIEW").trim().toUpperCase(),
        effect: String(row?.effect || "ALLOW").trim().toUpperCase(),
      }))
      .filter(
        (row) =>
          row.permissionKey &&
          allowedPermissions.has(row.permissionKey) &&
          ["VIEW", "PERFORM", "MANAGE"].includes(row.action) &&
          ["ALLOW", "DENY"].includes(row.effect)
      );

    if (!validRows.length) {
      return res.status(400).json({ message: "No valid permission entries provided" });
    }

    const hospitalScope =
      actorRole === "HOSPITAL_ADMIN" ? req.user.hospital || null : target.hospital || null;

    const result = [];
    for (const row of validRows) {
      const saved = await DelegatedPermission.findOneAndUpdate(
        {
          grantee: target._id,
          permissionKey: row.permissionKey,
          action: row.action,
          active: true,
          grantedBy: req.user._id,
        },
        {
          $set: {
            effect: row.effect,
            hospital: hospitalScope,
            grantedBy: req.user._id,
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      ).lean();
      result.push(saved);
    }

    await cacheDel(`menu:${String(target._id)}:*`);

    await logAudit({
      actorId: req.user?._id,
      actorRole: req.user?.role,
      action: "DELEGATED_PERMISSIONS_UPDATED",
      resource: "delegated_permission",
      resourceId: target._id,
      hospital: req.user?.hospital || req.user?.hospitalId || null,
      after: {
        targetUserId: String(target._id),
        entries: validRows,
      },
      ip: req.ip,
      userAgent: req.get?.("user-agent"),
    });

    return res.json({
      message: "Delegated permissions updated",
      target,
      grants: result,
    });
  } catch (err) {
    console.error("Delegation upsert error:", err);
    return res.status(500).json({ message: "Failed to save delegated permissions" });
  }
};

export const removeDelegatedPermission = async (req, res) => {
  try {
    const target = await loadTargetUser(req.params.userId);
    if (!target) return res.status(404).json({ message: "Target user not found" });
    if (!canManageTarget(req, target)) return res.status(403).json({ message: "Forbidden" });

    const permissionKey = String(req.body?.permissionKey || "").trim();
    const action = String(req.body?.action || "VIEW").trim().toUpperCase();
    if (!permissionKey || !["VIEW", "PERFORM", "MANAGE"].includes(action)) {
      return res.status(400).json({ message: "permissionKey and valid action are required" });
    }

    const deleted = await DelegatedPermission.updateMany(
      {
        grantee: target._id,
        permissionKey,
        action,
        active: true,
        grantedBy: req.user._id,
      },
      { $set: { active: false } }
    );

    await cacheDel(`menu:${String(target._id)}:*`);

    return res.json({
      message: "Delegated permission removed",
      modified: deleted?.modifiedCount || 0,
    });
  } catch (err) {
    console.error("Delegation delete error:", err);
    return res.status(500).json({ message: "Failed to remove delegated permission" });
  }
};
