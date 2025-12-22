import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../utils/auth";

/**
 * Protected route wrapper
 * @param {ReactNode} children
 * @param {Array<string>} roles - allowed roles
 */
export default function Protected({ children, roles }) {
  const { user, loading } = useAuth();

  // ⏳ Wait until auth is restored
  if (loading) return null;

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
