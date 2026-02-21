import { useAuth } from "../utils/auth";
import { PERMISSIONS } from "../config/permissions";

export const useCan = () => {
  const { user } = useAuth();

  const can = (resource, action) => {
    if (!user) return false;

    const allowedRoles =
      PERMISSIONS?.[resource]?.[action] || [];

    return allowedRoles.includes(user.role);
  };

  return { can };
};
