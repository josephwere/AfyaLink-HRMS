import React from "react";
import { useNavigate } from "react-router-dom";

export default function GuestDashboard() {
  const navigate = useNavigate();

  return (
    <div className="guest-wrap">
      <header className="guest-header">
        <h1>AfyaLink HRMS</h1>
        <span className="guest-badge">Demo Mode</span>
      </header>

      <p className="guest-subtitle">
        You’re exploring AfyaLink in a <strong>read-only demo environment</strong>.
      </p>

      <section className="guest-info">
        <h3>What you can do</h3>
        <ul>
          <li>✔ Preview dashboards & navigation</li>
          <li>✔ Explore AI medical tools</li>
          <li>✔ See role-based layouts</li>
        </ul>

        <h3 style={{ marginTop: 16 }}>What’s locked</h3>
        <ul>
          <li>🔒 Creating or editing records</li>
          <li>🔒 Payments & prescriptions</li>
          <li>🔒 Admin & staff actions</li>
        </ul>
      </section>

      <section className="guest-cta">
        <button className="primary" onClick={() => navigate("/register")}>
          Create Free Patient Account
        </button>

        <button className="secondary" onClick={() => navigate("/login")}>
          Sign In
        </button>
      </section>
    </div>
  );
}
