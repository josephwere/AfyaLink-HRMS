import User from "../models/User.js";
import DelegatedPermission from "../models/DelegatedPermission.js";
import { getPolicyForType } from "./approvalPolicyService.js";
import { normalizeRole } from "../utils/normalizeRole.js";

function normalizeApprovalLevel(level = {}) {
  const normalizedRoles = (level.roles || []).map((role) => normalizeRole(role)).filter(Boolean);
  return {
    level: Number(level.level || 0),
    roles: normalizedRoles,
    minAmount: Number(level.minAmount || 0),
    maxAmount: Number(level.maxAmount ?? Number.MAX_SAFE_INTEGER),
    minimumApprovals: Number(level.minimumApprovals || 1),
  };
}

function buildUserQuery({ hospitalId, roles, branch, department }) {
  const query = {
    hospital: hospitalId,
    active: true,
    role: { $in: roles },
  };

  if (branch) query["employment.branch"] = String(branch).trim();
  if (department) query["employment.department"] = String(department).trim();

  return query;
}

export async function resolveApprovers({ hospitalId, workflowType, amount = 0, branch = null, department = null }) {
  if (!hospitalId || !workflowType) return null;

  const policy = await getPolicyForType({ hospitalId, workflowType, amount });
  if (!policy) return null;

  const resolvedLevels = [];
  const candidates = [];

  for (const rawLevel of policy.approvalLevels || []) {
    const level = normalizeApprovalLevel(rawLevel);
    let users = [];
    if (level.roles.length) {
      users = await User.find(buildUserQuery({ hospitalId, roles: level.roles, branch, department }))
        .select("_id name email role employment.branch employment.department systemProfile active")
        .lean();

      // filter out inactive or on-leave users and attempt to include delegates
      const finalUsers = [];
      for (const u of users) {
        if (!u || !u._id) continue;
        // exclude inactive or on-leave users
        const onLeave = u.systemProfile && u.systemProfile.status === "ON_LEAVE";
        const isActive = u.active !== false && !onLeave;
        if (isActive) {
          finalUsers.push(u);
          continue;
        }

        // find delegated permissions where this user granted permissions to others
        try {
          const grants = await DelegatedPermission.find({ grantedBy: u._id, active: true, effect: "ALLOW", action: { $in: ["PERFORM", "MANAGE"] } }).populate("grantee");
          for (const g of grants || []) {
            if (g && g.grantee && g.grantee._id && g.grantee.active !== false) {
              finalUsers.push({
                _id: g.grantee._id,
                name: g.grantee.name,
                email: g.grantee.email,
                role: g.grantee.role,
                delegatedFor: String(u._id),
              });
            }
          }
        } catch (e) {
          // ignore delegated resolution errors
        }
      }

      users = finalUsers;
    }

    const userIds = users.map((user) => String(user._id));
    const resolvedLevel = {
      level: level.level,
      roles: level.roles,
      users: userIds,
      userCount: users.length,
      minAmount: level.minAmount,
      maxAmount: level.maxAmount,
      minimumApprovals: level.minimumApprovals,
    };

    resolvedLevels.push(resolvedLevel);

    if (users.length > 0) {
      candidates.push({
        level: resolvedLevel.level,
        roles: resolvedLevel.roles,
        users,
      });
    }
  }

  return {
    policy,
    resolvedLevels,
    candidates,
    minimumApprovals: Number(policy.minimumApprovals || 1),
    delegationAllowed: Boolean(policy.delegationAllowed),
    escalationHours: Number(policy.escalationHours || 0),
  };
}
