import React from "react";
import { useNavigate } from "react-router-dom";

export default function GuestDashboard() {
  const navigate = useNavigate();

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>AfyaLink Guest Portal</h2>
          <p className="muted">Public access for appointments, doctor directory, services and pre-registration.</p>
        </div>
        <div className="welcome-actions">
          <button className="btn-primary" onClick={() => navigate("/register")}>Book Appointment</button>
          <button className="btn-secondary" onClick={() => navigate("/login")}>Sign In</button>
        </div>
      </div>

      <section className="section">
        <h3>Guest Services</h3>
        <div className="panel-grid">
          <div className="panel">Search Doctor</div>
          <div className="panel">Appointment Booking Form</div>
          <div className="panel">Hospital Services</div>
          <div className="panel">Contact & Support</div>
          <div className="panel">Pre-Registration</div>
        </div>
      </section>
    </div>
  );
}
