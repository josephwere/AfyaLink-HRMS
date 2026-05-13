// frontend/src/routes/ProtectedRoute.jsx

import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../utils/auth";
import { requireRole } from "../utils/requireRole";
import AuthGateFallback from "../components/AuthGateFallback";

export default function ProtectedRoute({ roles = [] }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading && !user) {
    return (
      <AuthGateFallback
        title="Opening page"
        detail="Checking your account and permissions before this page loads."
      />
    );
  }

  const check = requireRole(user, ...roles);

  if (!check.allowed) {
    if (check.reason === "UNAUTHENTICATED") {
      return (
        <Navigate
          to="/login"
          replace
          state={{ from: location }}
        />
      );
    }

    return <Navigate to="/403" replace />;
  }

  return <Outlet />;
}
