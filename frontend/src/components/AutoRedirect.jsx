import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../utils/auth";
import { redirectByRole } from "../utils/redirectByRole";

export default function AutoRedirect({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !user) return;

    const correctPath = redirectByRole(user);

    // Already in correct area → do nothing
    if (location.pathname.startsWith(correctPath)) return;

    // Allow shared routes
    const allowedShared = [
      "/unauthorized",
      "/verify-email",
      "/verify-success",
    ];

    if (allowedShared.includes(location.pathname)) return;

    // 🔁 Redirect silently
    navigate(correctPath, { replace: true });
  }, [user, loading, location.pathname, navigate]);

  return children;
}
