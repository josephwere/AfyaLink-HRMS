import { useAuth } from "../utils/auth";
import { requireRole } from "../utils/requireRole";

export default function RequireRole({ roles, children }) {
  const { user } = useAuth();
  const check = requireRole(user, ...roles);

  if (!check.allowed) return null;
  return children;
}
