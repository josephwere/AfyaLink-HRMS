import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import apiFetch from "../utils/apiFetch";
import { redirectByRole } from "../utils/redirectByRole";
import { useAuth } from "./useAuth";

/**
 * Hook to handle Google OAuth login/signup
 * Returns a React component for Google button and state
 */
export function useGoogleAuth() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      setLoading(true);
      setError("");

      if (!credentialResponse?.credential) {
        throw new Error("Missing Google credential");
      }

      // Send credential to backend
      const data = await apiFetch("/api/auth/google", {
        method: "POST",
        body: { credential: credentialResponse.credential },
      });

      // Store token and update auth context
      await login(null, { directToken: true, token: data.accessToken, user: data.user });

      // Redirect user based on role
      navigate(redirectByRole(data.user), { replace: true });
    } catch (err) {
      console.error("Google login error:", err);
      setError(err.message || "Google authentication failed");
    } finally {
      setLoading(false);
    }
  };

  // GoogleLogin button component
  const GoogleButton = () => (
    <GoogleLogin
      onSuccess={handleGoogleSuccess}
      onError={() => setError("Google authentication failed")}
    />
  );

  return { GoogleButton, error, loading };
}
