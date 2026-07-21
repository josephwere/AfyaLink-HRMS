import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { redirectByRole } from "../utils/redirectByRole";
import { useAuth } from "../utils/auth";
import { useGoogleAuth } from "../auth/useGoogleAuth.jsx";
import { useSystemSettings } from "../utils/systemSettings.jsx";
import { normalizeAuthUiError, warmAuthRuntime } from "../services/guardedAuthFetch";

function getStorage() {
  if (typeof window === "undefined") return null;
  try {
    const storage = window.localStorage;
    if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function" || typeof storage.removeItem !== "function") {
      return null;
    }
    return storage;
  } catch {
    return null;
  }
}

export function useLogin() {
  const { login } = useAuth();
  const { settings } = useSystemSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const { GoogleButton, error: googleError, clearError } = useGoogleAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [slowAuth, setSlowAuth] = useState(false);
  const [isOffline, setIsOffline] = useState(typeof navigator !== "undefined" ? !navigator.onLine : false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("verify")) {
      setInfo("Account created. Verify your email from Profile inside the app.");
    }
  }, [location.search]);

  useEffect(() => {
    const saved = getStorage()?.getItem("remember_email");
    if (saved) {
      setIdentifier(saved);
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    document.body.classList.add("auth-route");
    return () => document.body.classList.remove("auth-route");
  }, []);

  useEffect(() => {
    warmAuthRuntime("auth-entry").catch(() => {});
  }, []);

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setSubmitting(true);
    setSlowAuth(false);
    clearError?.();
    const slowTimer = setTimeout(() => setSlowAuth(true), 2500);

    try {
      const storage = getStorage();
      rememberMe
        ? storage?.setItem("remember_email", identifier)
        : storage?.removeItem("remember_email");

      const authResult = await login(identifier.trim(), password);

      if (authResult?.requires2FA) {
        navigate("/2fa", {
          state: {
            userId: authResult.userId,
            email: identifier,
            method: authResult.method,
            reason: authResult.reason,
          },
        });
        return;
      }

      if (!authResult?.user) throw new Error("Invalid credentials");

      if (authResult?.offline) {
        setInfo("Offline mode: signed in using cached credentials on this device.");
      }

      // Forward a short-lived info message to landing and also emit a local notification
      const verificationReminder =
        !authResult.user.emailVerified && !authResult.user.phoneVerified
          ? "Your account is signed in. Complete email or phone verification from Profile when you are ready."
          : "";
      const postLoginInfo =
        authResult?.info ||
        authResult?.message ||
        verificationReminder ||
        (authResult?.offline ? "Offline mode: signed in." : "Signed in successfully.");
      try {
        if (postLoginInfo) {
          window.dispatchEvent(new CustomEvent("afyalink:notification-local", { detail: { title: "Signed in", body: postLoginInfo, category: "ACCOUNT", meta: {} } }));
        }
      } catch (e) {
        // ignore if window not available
      }

      navigate(redirectByRole(authResult.user), { replace: true, state: { info: postLoginInfo } });
    } catch (err) {
      setError(
        normalizeAuthUiError(err, {
          timeoutMessage:
            "We’re warming AfyaLink sign-in and retrying in the background. Please wait a few seconds and try again.",
          networkMessage:
            "AfyaLink sign-in is temporarily unavailable. Please check your connection and try again.",
          fallback: "Invalid credentials",
        })
      );
    } finally {
      clearTimeout(slowTimer);
      setSubmitting(false);
      setSlowAuth(false);
    }
  };

  return {
    settings,
    identifier,
    setIdentifier,
    password,
    setPassword,
    rememberMe,
    setRememberMe,
    error,
    setError,
    info,
    setInfo,
    submitting,
    slowAuth,
    isOffline,
    GoogleButton,
    googleError,
    clearError,
    handleSubmit,
  };
}

export default useLogin;
