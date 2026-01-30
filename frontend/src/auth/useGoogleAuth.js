import { useState } from "react";
import { useAuth } from "./useAuth";
import apiFetch from "../utils/apiFetch";
import { GoogleLogin } from "@react-oauth/google";

export function useGoogleAuth() {
  const { login } = useAuth();
  const [error, setError] = useState("");

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      if (!credentialResponse?.credential) throw new Error("Missing Google credential");

      const data = await apiFetch("/api/auth/google", {
        method: "POST",
        body: { credential: credentialResponse.credential },
      });

      await login(null, {
        directToken: true,
        token: data.token, // must match backend
        user: data.user,
      });
    } catch (err) {
      console.error("Google login failed:", err);
      setError(err.message || "Google authentication failed");
    }
  };

  const handleGoogleError = () => setError("Google login failed");
  const clearError = () => setError("");

  const GoogleButton = () => (
    <GoogleLogin onSuccess={handleGoogleSuccess} onError={handleGoogleError} />
  );

  return { GoogleButton, error, clearError };
}
