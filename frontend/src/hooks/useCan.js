import { useAuth } from "../utils/auth";
import { PERMISSIONS } from "../config/permissions";
import { normalizeRole } from "../utils/normalizeRole";

export const useCan = () => {
  const { user } = useAuth();

  const can = (resource, action) => {
    if (!user) return false;

    const role = normalizeRole(user.role);
    const actualRole = normalizeRole(user.actualRole);
    const strictImpersonation =
      typeof window !== "undefined" &&
      window.localStorage?.getItem("strict_impersonation") === "1";
    if (!strictImpersonation && ["SUPER_ADMIN", "DEVELOPER"].includes(actualRole)) {
      return true;
    }

    const allowedRoles =
      PERMISSIONS?.[resource]?.[action] || [];

    return allowedRoles.includes(role);
  };

  return { can };
};
