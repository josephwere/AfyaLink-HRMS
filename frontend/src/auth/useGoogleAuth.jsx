// frontend/src/auth/useGoogleAuth.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import apiFetch from "../utils/apiFetch";
import { useAuth } from "../utils/auth";
import { redirectByRole } from "../utils/redirectByRole";

export function useGoogleAuth() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  const handleSuccess = async (credentialResponse) => {
    try {
      setError(null);

      if (!credentialResponse?.credential) {
        throw new Error("Missing Google credential");
      }

      const data = await apiFetch("/api/auth/google", {
        method: "POST",
        body: { credential: credentialResponse.credential },
      });

      const token = data.accessToken || data.token;
      await login(null, {
        directToken: true,
        token,
        refreshToken: data.refreshToken,
        user: data.user,
      });

      navigate(redirectByRole(data.user), { replace: true });
    } catch (err) {
      setError(err.message || "Google authentication failed");
    }
  };

  return {
    GoogleButton: () => (
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={() => setError("Google authentication failed")}
      />
    ),
    error,
    clearError: () => setError(null),
  };
}
