// frontend/src/pages/Register.jsx
import React from "react";
import { Link } from "react-router-dom";

import PasswordInput from "../components/PasswordInput";
import CountryPhoneInput from "../components/CountryPhoneInput";
import LegalLinks from "../components/LegalLinks";
import { useRegister } from "../hooks/useRegister";

export default function Register() {
  const {
    form,
    setForm,
    countries,
    submitting,
    error,
    info,
    settings,
    GoogleButton,
    googleError,
    handleChange,
    handleSubmit,
  } = useRegister();

  /* -------------------------
     UI
  -------------------------- */
  return (
    <div className={`auth-bg ${settings?.branding?.loginBackground ? "auth-bg-ready" : ""}`}>
      <form className="auth-card" onSubmit={handleSubmit}>
        {settings?.branding?.logo && (
          <div
            className="brand-logo"
            style={{
              backgroundImage: `url(${settings.branding.logo})`,
              margin: "0 auto 10px",
            }}
          />
        )}
        <div className="auth-kicker">Patient account setup</div>
        <h1>Create account</h1>
        <p className="subtitle">
          Create a patient account to book appointments, receive updates, and view records that are available to you.
        </p>

        <div className="auth-utility-list" aria-label="Registration details">
          <div className="auth-utility-item">Provide only the contact details needed for account recovery and verification.</div>
          <div className="auth-utility-item">National ID details are used for identity matching, consent, and insurance workflows where required.</div>
        </div>

        {error && <div className="auth-error">{error}</div>}
        {info && <div className="auth-info">{info}</div>}
        {googleError && googleError !== error && <div className="auth-error">{googleError}</div>}

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
          Unverified accounts may be removed after the verification deadline.
        </div>

        <div className="muted auth-terms-copy">
          By creating an account, you agree to the <Link to="/terms">Terms of Service</Link> and acknowledge the <Link to="/privacy">Privacy Policy</Link>.
        </div>

        <button type="submit" disabled={submitting}>
          {submitting ? "Creating account..." : "Create account"}
        </button>

        <div className="divider">or</div>

        {/* Google login/signup */}
        <GoogleButton />

        <div className="auth-footer">
          <span>Already have an account?</span>
          <Link to="/login">Sign in</Link>
        </div>

        <div className="auth-footer">
          <span>Review hospital job listings first?</span>
          <Link to="/careers?src=REGISTER_PAGE">View careers</Link>
        </div>

        <LegalLinks className="auth-legal-links" />
      </form>
    </div>
  );
}
