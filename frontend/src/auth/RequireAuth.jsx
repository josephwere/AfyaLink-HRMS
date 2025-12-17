import { Navigate } from "react-router-dom";
import { useAuth } from "./useAuth";

export default function RequireAuth({ roles, children }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}