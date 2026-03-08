// frontend/src/pages/Register.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import PasswordInput from "../components/PasswordInput";
import CountryPhoneInput, { toE164 } from "../components/CountryPhoneInput";
import apiFetch from "../utils/apiFetch";
import { redirectByRole } from "../utils/redirectByRole";
import { useAuth } from "../utils/auth";
import { useGoogleAuth } from "../auth/useGoogleAuth.jsx";
import { getCountryOptions } from "../utils/countryDialCodes";
import { useSystemSettings } from "../utils/systemSettings.jsx";
import {
  enqueueOfflineRegistration,
  flushOfflineRegistrations,
} from "../utils/offlineRegistration";

export default function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { settings } = useSystemSettings();
  const { GoogleButton, error: googleError } = useGoogleAuth();

  const [form, setForm] = useState({
    name: "",
    email: "",
    phoneCountry: "",
    phoneLocal: "",
    nationalIdNumber: "",
    nationalIdCountry: "",
    password: "",
    confirmPassword: "",
  });
  const countries = React.useMemo(() => getCountryOptions(), []);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [bgReady, setBgReady] = useState(false);

  React.useEffect(() => {
    document.body.classList.add("auth-route");
    return () => document.body.classList.remove("auth-route");
  }, []);

  React.useEffect(() => {
    const src = settings?.branding?.loginBackground;
    if (!src) {
      setBgReady(false);
      return;
    }
    let active = true;
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      if (active) setBgReady(true);
    };
    img.onerror = () => {
      if (active) setBgReady(false);
    };
    img.src = src;
    return () => {
      active = false;
    };
  }, [settings?.branding?.loginBackground]);

  React.useEffect(() => {
    const sync = () => {
      flushOfflineRegistrations().catch(() => {});
    };
    sync();
    window.addEventListener("online", sync);
    return () => window.removeEventListener("online", sync);
  }, []);

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

    const payload = {
      name: form.name.trim(),
      email: form.email ? form.email.toLowerCase().trim() : undefined,
      phone:
        form.phoneCountry && form.phoneLocal
          ? toE164(form.phoneCountry, form.phoneLocal)
          : undefined,
      nationalIdNumber: form.nationalIdNumber || undefined,
      nationalIdCountry: form.nationalIdCountry || undefined,
      password: form.password,
    };

    if (!navigator.onLine) {
      enqueueOfflineRegistration(payload);
      setInfo(
        "Offline: registration saved on this device and will auto-submit when internet returns."
      );
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setInfo("");

      const data = await apiFetch("/api/auth/register", {
        method: "POST",
        body: payload,
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
      const msg = err.message || "";
      const networkLike = msg.toLowerCase().includes("network error") || !navigator.onLine;
      if (networkLike) {
        enqueueOfflineRegistration(payload);
        setInfo(
          "Network unavailable. Registration saved offline and will auto-submit when internet returns."
        );
      } else {
        setError(msg || "Registration failed");
      }
    } finally {
      setSubmitting(false);
    }
  };

  /* -------------------------
     UI
  -------------------------- */
  return (
    <div className={`auth-bg ${bgReady ? "auth-bg-ready" : ""}`}>
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

        <CountryPhoneInput
          countryLabel="Phone Country (optional)"
          phoneLabel="Phone number (optional)"
          countryCode={form.phoneCountry}
          localNumber={form.phoneLocal}
          onCountryCodeChange={(v) => setForm((prev) => ({ ...prev, phoneCountry: v }))}
          onLocalNumberChange={(v) => setForm((prev) => ({ ...prev, phoneLocal: v }))}
        />

        <label>National ID Number</label>
        <input
          name="nationalIdNumber"
          value={form.nationalIdNumber}
          onChange={handleChange}
        />

        <label>National ID Country</label>
        <select
          name="nationalIdCountry"
          value={form.nationalIdCountry}
          onChange={handleChange}
        >
          <option value="">Select country</option>
          {countries.map((country) => (
            <option key={country.code} value={country.code}>
              {country.name} ({country.code})
            </option>
          ))}
        </select>

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

        <button type="submit" disabled={submitting}>
          {submitting ? "Creating account..." : "Create account"}
        </button>

        <div className="divider">or</div>

        {/* Google login/signup */}
        <GoogleButton />

        <div className="auth-footer">
          <span>Already have an account?</span>
          <Link to="/login">Login</Link>
        </div>

        <div className="auth-footer">
          <span>Browse open hospital roles first?</span>
          <Link to="/careers?src=REGISTER_PAGE">View careers</Link>
        </div>
      </form>
    </div>
  );
}
