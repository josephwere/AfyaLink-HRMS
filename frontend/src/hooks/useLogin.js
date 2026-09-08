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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const KENYA_PHONE_REGEX = /^(\+254|254|0)\d{9}$/;

function validateLoginFields(identifier, password) {
  const trimmedIdentifier = String(identifier || "").trim();
  const trimmedPassword = String(password || "").trim();
  const errors = [];
  const normalizedIdentifier = trimmedIdentifier.replace(/\s+/g, "");

  if (!trimmedIdentifier) {
    errors.push("This field is required");
  } else if (trimmedIdentifier.includes("@") && !EMAIL_REGEX.test(trimmedIdentifier)) {
    errors.push("Email address is invalid");
  } else if (
    /^[0-9+]+$/.test(normalizedIdentifier) &&
    (normalizedIdentifier.startsWith("+254") || normalizedIdentifier.startsWith("254") || normalizedIdentifier.startsWith("0")) &&
    !KENYA_PHONE_REGEX.test(normalizedIdentifier)
  ) {
    errors.push("Enter a valid Kenyan phone number");
  }

  if (!trimmedPassword) {
    errors.push("This field is required");
  }

  return errors;
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
  const [fieldErrors, setFieldErrors] = useState({});

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

  const handleFieldChange = (name, value) => {
    if (name === "identifier") setIdentifier(value);
    if (name === "password") setPassword(value);
    setError("");
    setInfo("");
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (name === "identifier") next.identifier = undefined;
      if (name === "password") next.password = undefined;
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validateLoginFields(identifier, password);
    if (validationErrors.length) {
      setFieldErrors({
        identifier: validationErrors.find((item) => item.toLowerCase().includes("field") || item.toLowerCase().includes("email") || item.toLowerCase().includes("phone")),
        password: validationErrors.find((item) => item.toLowerCase().includes("field")),
      });
      setError(validationErrors[0]);
      return;
    }

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

      console.log('[debug] handleSubmit: calling login for', String(identifier).trim());
      const authResult = await login(identifier.trim(), password);
      console.log('[debug] handleSubmit: login returned', authResult);

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
    fieldErrors,
    handleFieldChange,
    handleSubmit,
  };
}

export default useLogin;
