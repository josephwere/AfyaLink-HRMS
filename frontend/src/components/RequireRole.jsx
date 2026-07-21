import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../utils/auth";
import { requireRole } from "../utils/requireRole";
import { useUserContext } from "../contexts/UserContextContext";
import { getContextRedirectPath } from "../contexts/contextRouteRules";
import AuthGateFallback from "./AuthGateFallback";

export default function RequireRole({ roles = [], children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { mode } = useUserContext();

  if (loading && !user) {
    return (
      <AuthGateFallback
        title="Opening page"
        detail="Confirming access and restoring the latest workspace state."
      />
    );
  }

  // 🔐 Not logged in → login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 🛑 Role check
  const check = requireRole(user, ...roles);

  if (!check.allowed) {
    return <Navigate to="/unauthorized" replace />;
  }

  const redirectPath = getContextRedirectPath(location.pathname, mode, user);
  if (redirectPath) {
    return <Navigate to={redirectPath} replace />;
  }

  // ✅ Allowed
  return children;
}
