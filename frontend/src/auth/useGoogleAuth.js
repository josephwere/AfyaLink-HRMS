import React, { useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import apiFetch from "../utils/apiFetch";
import { useAuth } from "./useAuth";

export function useGoogleAuth() {
  const { login } = useAuth();
  const [error, setError] = useState("");

  const clearError = () => setError("");

  const GoogleButton = useGoogleLogin({
    onSuccess: async (credentialResponse) => {
      try {
        clearError();

        if (!credentialResponse?.credential) {
          throw new Error("Missing Google credential");
        }

        const data = await apiFetch("/api/auth/google", {
          method: "POST",
          body: { credential: credentialResponse.credential },
        });

        await login(null, {
          directToken: true,
          token: data.token, // matches backend response key
          user: data.user,
        });
      } catch (err) {
        console.error("Google login failed:", err);
        setError(err.message || "Google authentication failed");
      }
    },
    onError: (err) => {
      console.error("Google login error:", err);
      setError("Google authentication failed");
    },
  });

  return { GoogleButton, error, clearError };
}
