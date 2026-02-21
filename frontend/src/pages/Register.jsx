// frontend/src/pages/Register.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import PasswordInput from "../components/PasswordInput";
import apiFetch from "../utils/apiFetch";
import { redirectByRole } from "../utils/redirectByRole";
import { useAuth } from "../utils/auth";
import { useGoogleAuth } from "../auth/useGoogleAuth.jsx";

export default function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { GoogleButton, error: googleError } = useGoogleAuth();

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    nationalIdNumber: "",
    nationalIdCountry: "",
    password: "",
    confirmPassword: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  /* -------------------------
     Form input handler
  -------------------------- */
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
    setInfo("");
  };

  /* -------------------------
     Email/password registration
  -------------------------- */
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

      const data = await apiFetch("/api/auth/register", {
        method: "POST",
        body: {
          name: form.name.trim(),
          email: form.email ? form.email.toLowerCase().trim() : undefined,
          phone: form.phone ? form.phone.trim() : undefined,
          nationalIdNumber: form.nationalIdNumber || undefined,
          nationalIdCountry: form.nationalIdCountry || undefined,
          password: form.password,
        },
      });

      // Auto-login after registration if backend provides tokens
      if (data.accessToken && data.user) {
        await login(null, { directToken: true, token: data.accessToken, user: data.user });
        setInfo("Account created! Verify your email from Profile inside the app.");
        navigate(redirectByRole(data.user), { replace: true });
      } else {
        setInfo(
          data.phoneOtpSent
            ? "Registration successful. An OTP was sent to your phone. Verify to activate your account."
            : data.msg || "Registration successful. Verify your email from Profile inside the app."
        );
        navigate("/login");
      }
    } catch (err) {
      const msg = err.message || "Registration failed";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  /* -------------------------
     UI
  -------------------------- */
  return (
    <div className="auth-bg">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Create your account</h1>
        <p className="subtitle">Join AfyaLink HRMS</p>

        {error && <div className="auth-error">{error}</div>}
        {info && <div className="auth-info">{info}</div>}
        {googleError && <div className="auth-error">{googleError}</div>}

        <label>Full Name</label>
        <input name="name" value={form.name} onChange={handleChange} required />

        <label>Email address (optional)</label>
        <input type="email" name="email" value={form.email} onChange={handleChange} />

        <label>Phone number (optional)</label>
        <input name="phone" value={form.phone} onChange={handleChange} />

        <label>National ID Number</label>
        <input
          name="nationalIdNumber"
          value={form.nationalIdNumber}
          onChange={handleChange}
        />

        <label>National ID Country</label>
        <input
          name="nationalIdCountry"
          value={form.nationalIdCountry}
          onChange={handleChange}
          placeholder="e.g. KE, US, NG"
        />

        <PasswordInput
          label="Password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          showStrength
          required
        />

        <PasswordInput
          label="Confirm password"
          value={form.confirmPassword}
          onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
          required
        />

        <div className="muted" style={{ marginBottom: 10 }}>
          Unverified accounts may be deleted after the verification deadline.
        </div>

        <button disabled={submitting}>
          {submitting ? "Creating account..." : "Create account"}
        </button>

        <div className="divider">or</div>

        {/* Google login/signup */}
        <GoogleButton />

        <div className="auth-footer">
          <span>Already have an account?</span>
          <Link to="/login">Login</Link>
        </div>
      </form>
    </div>
  );
}
