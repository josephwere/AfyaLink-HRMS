import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../utils/auth";
import { redirectByRole } from "../utils/redirectByRole";

export default function AutoRedirect({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return; // wait for auth to load
    if (!user) return; // no user → do nothing

    const correctPath = redirectByRole(user);

    // Only redirect from the root path.
    if (location.pathname === "/") {
      navigate(correctPath, { replace: true });
    }
  }, [user, loading, location.pathname, navigate]);

  return children;
  }
