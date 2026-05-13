import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../utils/auth";
import AuthGateFallback from "./AuthGateFallback";

export default function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading && !user) {
    return (
      <AuthGateFallback
        title="Opening page"
        detail="Checking your session before this page loads."
      />
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
