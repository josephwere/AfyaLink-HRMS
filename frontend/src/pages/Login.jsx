import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../utils/auth";
import { apiFetch } from "../utils/apiFetch";
import PasswordInput from "../components/PasswordInput";

export default function Login() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  // 🔁 Resend verification states
  const [resendLoading, setResendLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  /* ---------------------------------------
     Show verification message after register
  ---------------------------------------- */
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("verify")) {
      setInfo(
        "Account created successfully. Please verify your email before logging in."
      );
    }
  }, [location.search]);

  /* ---------------------------------------
     Load remembered email
  ---------------------------------------- */
  useEffect(() => {
    const savedEmail = localStorage.getItem("remember_email");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  /* ---------------------------------------
     Cooldown timer (anti-spam)
  ---------------------------------------- */
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((c) => c - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  /* ---------------------------------------
     Submit handler (2FA + email verification safe)
  ---------------------------------------- */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");

    try {
      if (rememberMe) {
        localStorage.setItem("remember_email", email);
      } else {
        localStorage.removeItem("remember_email");
      }

      const result = await login(email.trim(), password);

      // 🔐 EMAIL NOT VERIFIED
      if (result?.requiresEmailVerification) {
        setError("Please verify your email before logging in.");
        return;
      }

      // 🔐 2FA REQUIRED
      if (result?.requires2FA) {
        navigate("/2fa", {
          state: {
            userId: result.userId,
            email,
          },
        });
        return;
      }

      // ✅ SUCCESS
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Invalid email or password");
    }
  };

  /* ---------------------------------------
     Resend verification handler
  ---------------------------------------- */
  const handleResendVerification = async () => {
    try {
      setResendLoading(true);
      setError("");
      setInfo("");

      const res = await apiFetch("/api/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.msg);

      setInfo("Verification email resent. Check your inbox.");
      setCooldown(60); // ⏱️ 60 seconds
    } catch (err) {
      setError(err.message);
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="auth-bg">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Welcome back</h1>
        <p className="subtitle">Sign in to AfyaLink HRMS</p>

        {error && <div className="auth-error">{error}</div>}
        {info && <div className="auth-info">{info}</div>}

        {/* 🔁 RESEND VERIFICATION BUTTON */}
        {error?.toLowerCase().includes("verify") && (
          <button
            type="button"
            onClick={handleResendVerification}
            disabled={resendLoading || cooldown > 0}
            className="resend-btn"
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
          placeholder="you@example.com"
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

        <button disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>

        <div className="auth-footer">
          <span>Don’t have an account?</span>
          <Link to="/register">Create account</Link>
        </div>
      </form>
    </div>
  );
                                       }
