import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import PasswordInput from "../components/PasswordInput";
import { apiFetch } from "../utils/apiFetch";

const COOLDOWN_KEY = "verifyCooldownUntil";

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [resendLoading, setResendLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [showResend, setShowResend] = useState(false);

  /* ---------------------------------------
     Restore cooldown (absolute timestamp)
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
     Tick cooldown
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
     Submit
  ---------------------------------------- */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setInfo("");
      setShowResend(false);

      const res = await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.toLowerCase().trim(),
          password: form.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data?.message || data?.msg || "Registration failed";

        // 🔑 CRITICAL FIX:
        // Email already exists but NOT verified
        if (msg.toLowerCase().includes("email")) {
          setShowResend(true);
        }

        throw new Error(msg);
      }

      // ✅ Success → ask user to verify
      navigate("/login?verify=true");
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  /* ---------------------------------------
     Resend verification
  ---------------------------------------- */
  const handleResendVerification = async () => {
    try {
      setResendLoading(true);
      setError("");
      setInfo("");

      const res = await apiFetch("/api/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email: form.email }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.retryAfter) {
          const until = Date.now() + data.retryAfter * 1000;
          localStorage.setItem(COOLDOWN_KEY, until);
          setCooldown(data.retryAfter);
        }
        throw new Error(data.msg);
      }

      const seconds = data.retryAfter || 60;
      const until = Date.now() + seconds * 1000;

      localStorage.setItem(COOLDOWN_KEY, until);
      setCooldown(seconds);

      setInfo("Verification email resent. Check your inbox.");
    } catch (err) {
      setError(err.message);
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="auth-bg">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Create your account</h1>
        <p className="subtitle">Join AfyaLink HRMS</p>

        {error && <div className="auth-error">{error}</div>}
        {info && <div className="auth-info">{info}</div>}

        {/* 🔁 RESEND VERIFICATION */}
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
        <input
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="Joseph Were"
          required
        />

        <label>Email address</label>
        <input
          type="email"
          name="email"
          value={form.email}
          onChange={handleChange}
          placeholder="you@example.com"
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

        <button disabled={loading}>
          {loading ? "Creating account..." : "Create account"}
        </button>

        <div className="auth-footer">
          <span>Already have an account?</span>
          <Link to="/login">Login</Link>
        </div>
      </form>
    </div>
  );
}
