// src/pages/Login.jsx
import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";

import { useAuth } from "../utils/auth";
import apiFetch from "../utils/apiFetch";
import { redirectByRole } from "../utils/redirectByRole";
import PasswordInput from "../components/PasswordInput";

const COOLDOWN_KEY = "verifyCooldownUntil";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [resendLoading, setResendLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [showResend, setShowResend] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Restore resend cooldown
  useEffect(() => {
    const until = Number(localStorage.getItem(COOLDOWN_KEY));
    if (!until) return;

    const remaining = Math.ceil((until - Date.now()) / 1000);
    if (remaining > 0) {
      setCooldown(remaining);
      setShowResend(true);
    } else {
      localStorage.removeItem(COOLDOWN_KEY);
    }
  }, []);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          localStorage.removeItem(COOLDOWN_KEY);
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldown]);

  // Post-register notice
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("verify")) {
      setInfo("Account created. Please verify your email.");
      setShowResend(true);
    }
  }, [location.search]);

  // Remember email
  useEffect(() => {
    const saved = localStorage.getItem("remember_email");
    if (saved) {
      setEmail(saved);
      setRememberMe(true);
    }
  }, []);

  // EMAIL + PASSWORD LOGIN
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setShowResend(false);
    setSubmitting(true);

    try {
      rememberMe
        ? localStorage.setItem("remember_email", email)
        : localStorage.removeItem("remember_email");

      const result = await login(email.trim(), password);

      if (result?.requires2FA) {
        navigate("/2fa", {
          state: { userId: result.userId, email },
        });
        return;
      }

      if (!result?.user || !result?.accessToken) {
        throw new Error("Invalid credentials");
      }

      // Save token for API calls
      localStorage.setItem("accessToken", result.accessToken);

      navigate(redirectByRole(result.user), { replace: true });
    } catch (err) {
      if (
        err.message?.toLowerCase().includes("verify") ||
        err.message?.toLowerCase().includes("verified")
      ) {
        setShowResend(true);
      }
      setError(err.message || "Invalid credentials");
    } finally {
      setSubmitting(false);
    }
  };

  // RESEND VERIFICATION
  const handleResendVerification = async () => {
    try {
      setResendLoading(true);
      setError("");
      setInfo("");

      const data = await apiFetch("/api/auth/resend-verification", {
        method: "POST",
        body: { email },
      });

      const seconds = data.retryAfter || 60;
      localStorage.setItem(COOLDOWN_KEY, Date.now() + seconds * 1000);
      setCooldown(seconds);

      setInfo("Verification email sent. Check your inbox.");
    } catch (err) {
      setError(err.message || "Failed to resend verification email");
    } finally {
      setResendLoading(false);
    }
  };

  // GOOGLE LOGIN
  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      if (!credentialResponse?.credential) {
        throw new Error("Missing Google credential");
      }

      // Send Google token to backend
      const data = await apiFetch("/api/auth/google", {
        method: "POST",
        body: { credential: credentialResponse.credential },
      });

      if (!data?.accessToken || !data?.user) {
        throw new Error("Google login failed");
      }

      // Save token for API requests
      localStorage.setItem("accessToken", data.accessToken);

      // Update auth context
      login(null, { directToken: true, token: data.accessToken, user: data.user });

      // Redirect by role
      navigate(redirectByRole(data.user), { replace: true });
    } catch (err) {
      setError(err.message || "Google authentication failed");
    }
  };

  return (
    <div className="auth-bg">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Welcome back</h1>
        <p className="subtitle">Sign in to AfyaLink HRMS</p>

        {error && <div className="auth-error">{error}</div>}
        {info && <div className="auth-info">{info}</div>}

        {showResend && (
          <button
            type="button"
            onClick={handleResendVerification}
            disabled={resendLoading || cooldown > 0}
            className={`resend-btn ${cooldown > 0 ? "disabled" : ""}`}
          >
            {cooldown > 0
              ? `Resend available in ${cooldown}s`
              : resendLoading
              ? "Sending..."
              : "Resend verification email"}
          </button>
        )}

        <label>Email address</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <PasswordInput
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <div className="auth-row">
          <label className="remember">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            Remember me
          </label>

          <Link to="/forgot-password" className="forgot-link">
            Forgot password?
          </Link>
        </div>

        <button disabled={submitting}>
          {submitting ? "Signing in..." : "Sign in"}
        </button>

        <div className="divider">or</div>

        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={() => setError("Google authentication failed")}
        />

        <div className="auth-footer">
          <span>Don’t have an account?</span>
          <Link to="/register">Create account</Link>
        </div>
      </form>
    </div>
  );
}
