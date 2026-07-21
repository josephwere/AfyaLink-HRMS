import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../utils/auth";
import { useSystemSettings } from "../utils/systemSettings.jsx";
import { normalizeAuthUiError, warmAuthRuntime } from "../services/guardedAuthFetch";
import { verifyTwoFactor, resendTwoFactorCode } from "../services/authApi";

function maskIdentifier(value) {
  const raw = String(value || "").trim();
  if (!raw) return "your account";
  if (raw.includes("@")) {
    const [local, domain] = raw.split("@");
    if (!local || !domain) return raw;
    return `${local.slice(0, 2)}***@${domain}`;
  }
  const compact = raw.replace(/\s+/g, "");
  if (/^\+?\d+$/.test(compact)) {
    const visible = compact.slice(-3);
    return `${compact.slice(0, Math.min(4, compact.length)).replace(/\d/g, "*")}***${visible}`;
  }
  if (compact.length <= 4) return `${compact[0] || "*"}***`;
  return `${compact.slice(0, 2)}***${compact.slice(-2)}`;
}

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

function clearPending2FAState() {
  const storage = getStorage();
  storage?.removeItem("2fa_pending");
  storage?.removeItem("2fa_user");
  storage?.removeItem("2fa_method");
  storage?.removeItem("2fa_reason");
  storage?.removeItem("2fa_identifier");
}

export function useTwoFactor() {
  const navigate = useNavigate();
  const location = useLocation();
  const { complete2FA } = useAuth();
  const { settings } = useSystemSettings();

  const storage = getStorage();
  const userId = location.state?.userId || storage?.getItem("2fa_user");
  const pendingMethod = String(location.state?.method || storage?.getItem("2fa_method") || "OTP").toUpperCase();
  const pendingReason = String(location.state?.reason || storage?.getItem("2fa_reason") || "ACCOUNT_2FA").toUpperCase();
  const pendingIdentifier = location.state?.email || location.state?.identifier || storage?.getItem("2fa_identifier") || "";

  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    document.body.classList.add("auth-route");
    return () => document.body.classList.remove("auth-route");
  }, []);

  useEffect(() => {
    warmAuthRuntime("auth-entry").catch(() => {});
  }, []);

  useEffect(() => {
    if (!userId) {
      navigate("/login", { replace: true });
    }
  }, [userId, navigate]);

  useEffect(() => {
    if (!cooldown) return undefined;
    const timer = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const methodCopy = useMemo(() => {
    if (pendingMethod === "TOTP") {
      return {
        badge: "Authenticator required",
        title: "Enter authenticator code",
        subtitle: "Open your authenticator app and enter the current 6-digit code. Recovery codes also work here.",
        helper: pendingReason === "RISK_STEP_UP" || pendingReason === "RISK_CRITICAL_RESTRICTED"
          ? "This sign-in needs an extra check because the request did not match your usual pattern."
          : "This account requires an authenticator code before access is granted.",
        destination: null,
        canResend: false,
      };
    }

    return {
      badge: "Security code sent",
      title: "Enter security code",
      subtitle: "Enter the one-time code sent to your verified email or phone number. Recovery codes also work here.",
      helper: pendingReason === "RISK_STEP_UP" || pendingReason === "RISK_CRITICAL_RESTRICTED"
        ? "This additional check protects the account when sign-in risk is higher than usual."
        : "This account requires a second verification step before the workspace opens.",
      destination: pendingIdentifier ? `Last login attempt: ${maskIdentifier(pendingIdentifier)}` : null,
      canResend: true,
    };
  }, [pendingIdentifier, pendingMethod, pendingReason]);

  if (!userId) return null;

  const submitOtp = async (e) => {
    e.preventDefault();
    if (otp.trim().length < 6) return;

    setError("");
    setInfo("");
    setLoading(true);

    try {
      const data = await verifyTwoFactor({ userId, otp: otp.trim().toUpperCase() });
      complete2FA(data.accessToken, data.refreshToken, data.user);
      clearPending2FAState();
      navigate("/", { replace: true });
    } catch (err) {
      setError(
        normalizeAuthUiError(err, {
          timeoutMessage: "Two-factor verification is taking longer than usual. Please wait a few seconds and try again.",
          networkMessage: "Two-factor verification is temporarily unavailable. Please check your connection and try again.",
          fallback: "Verification failed",
        })
      );
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    if (!methodCopy.canResend || cooldown > 0) return;
    setResending(true);
    setError("");
    setInfo("");
    try {
      const data = await resendTwoFactorCode({ userId });
      setInfo(data?.msg || "A fresh 2FA code is on the way.");
      setCooldown(30);
    } catch (err) {
      setError(
        normalizeAuthUiError(err, {
          timeoutMessage: "Resending the security code is taking longer than usual. Please wait a few seconds and try again.",
          networkMessage: "Resending the security code is temporarily unavailable. Please check your connection and try again.",
          fallback: "Failed to resend the security code",
        })
      );
    } finally {
      setResending(false);
    }
  };

  const switchAccount = () => {
    clearPending2FAState();
    navigate("/login", { replace: true });
  };

  return {
    settings,
    methodCopy,
    pendingMethod,
    otp,
    setOtp,
    error,
    setError,
    info,
    setInfo,
    loading,
    resending,
    cooldown,
    submitOtp,
    resendCode,
    switchAccount,
  };
}

export default useTwoFactor;
