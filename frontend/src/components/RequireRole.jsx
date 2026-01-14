import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../utils/auth";
import { requireRole } from "../utils/requireRole";

export default function RequireRole({ roles = [], children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // ⏳ Wait for auth restore
  if (loading) return null;

  // 🔐 Not logged in → login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 🛑 Role check
  const check = requireRole(user, ...roles);

  if (!check.allowed) {
    return <Navigate to="/unauthorized" replace />;
  }

  // ✅ Allowed
  return children;
}
