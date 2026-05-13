import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../utils/auth";
import AuthGateFallback from "./AuthGateFallback";

/**
 * Protected route wrapper
 * @param {ReactNode} children
 * @param {Array<string>} roles - allowed roles
 */
export default function Protected({ children, roles }) {
  const { user, loading } = useAuth();

  if (loading && !user) {
    return (
      <AuthGateFallback
        title="Opening page"
        detail="Restoring access so this page can load correctly."
      />
    );
  }

  // 🔐 Not logged in
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 🚫 Role not allowed
  if (roles && roles.length && !roles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // ✅ Authorized
  return children;
}
