import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";

import PasswordInput from "../components/PasswordInput";
import apiFetch from "../utils/apiFetch";
import { redirectByRole } from "../utils/redirectByRole";

const COOLDOWN_KEY = "verifyCooldownUntil";

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [resendLoading, setResendLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [showResend, setShowResend] = useState(false);

  /* ---------------------------------------
     Restore resend cooldown
  ---------------------------------------- */
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

  /* ---------------------------------------
     Cooldown timer
  ---------------------------------------- */
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

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
    setInfo("");
  };

  /* ---------------------------------------
     EMAIL REGISTER (FINAL)
  ---------------------------------------- */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setInfo("");
      setShowResend(false);

      const data = await apiFetch("/api/auth/register", {
        method: "POST",
        body: {
          name: form.name.trim(),
          email: form.email.toLowerCase().trim(),
          password: form.password,
        },
      });

      setInfo(data.msg || "Registration successful. Verify your email.");
      navigate("/login?verify=true");
    } catch (err) {
      const msg = err.message || "Registration failed";

      if (msg.toLowerCase().includes("verify")) {
        setShowResend(true);
      }

      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------------------------------------
     RESEND VERIFICATION (MATCHES BACKEND)
  ---------------------------------------- */
  const handleResendVerification = async () => {
    try {
      setResendLoading(true);
      setError("");
      setInfo("");

      const data = await apiFetch("/api/auth/resend", {
        method: "POST",
        body: { email: form.email },
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

  /* ---------------------------------------
     GOOGLE SIGN-UP (SAFE)
  ---------------------------------------- */
  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      if (!credentialResponse?.credential) {
        throw new Error("Missing Google credential");
      }

      const data = await apiFetch("/api/auth/google", {
        method: "POST",
        body: { credential: credentialResponse.credential },
      });

      localStorage.setItem("token", data.accessToken);
      navigate(redirectByRole(data.user), { replace: true });
    } catch (err) {
      setError(err.message || "Google authentication failed");
    }
  };

  /* ---------------------------------------
     UI
  ---------------------------------------- */
  return (
    <div className="auth-bg">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Create your account</h1>
        <p className="subtitle">Join AfyaLink HRMS</p>

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

        <label>Full Name</label>
        <input name="name" value={form.name} onChange={handleChange} required />

        <label>Email address</label>
        <input
          type="email"
          name="email"
          value={form.email}
          onChange={handleChange}
          required
        />

        <PasswordInput
          label="Password"
          value={form.password}
          onChange={(e) =>
            setForm({ ...form, password: e.target.value })
          }
          showStrength
          required
        />

        <PasswordInput
          label="Confirm password"
          value={form.confirmPassword}
          onChange={(e) =>
            setForm({ ...form, confirmPassword: e.target.value })
          }
          required
        />

        <button disabled={submitting}>
          {submitting ? "Creating account..." : "Create account"}
        </button>

        <div className="divider">or</div>

        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={() => setError("Google authentication failed")}
        />

        <div className="auth-footer">
          <span>Already have an account?</span>
          <Link to="/login">Login</Link>
        </div>
      </form>
    </div>
  );
}
