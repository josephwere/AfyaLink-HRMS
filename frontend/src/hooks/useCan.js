import { useAuth } from "../utils/auth";
import { PERMISSIONS } from "../config/permissions";
import { requireRole } from "../utils/requireRole";

export const useCan = () => {
  const { user } = useAuth();

  const can = (resource, action) => {
    if (!user) return false;
    const allowedRoles = PERMISSIONS?.[resource]?.[action] || [];
    return requireRole(user, ...allowedRoles).allowed;
  };

  return { can };
};
