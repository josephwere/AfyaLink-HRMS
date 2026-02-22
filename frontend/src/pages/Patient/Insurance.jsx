import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiFetch from "../../utils/apiFetch";

export default function PatientInsurance() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [me, market] = await Promise.all([
        apiFetch("/api/profile"),
        apiFetch(`/api/hospitals/marketplace?q=${encodeURIComponent(q)}`),
      ]);
      setProfile(me || null);
      setHospitals(Array.isArray(market?.items) ? market.items : []);
    } catch {
      setProfile(null);
      setHospitals([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [q]);

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Insurance & Hospital Services</h2>
          <p className="muted">
            View your insurance balance/profile and find hospitals with supported insurance and payment channels.
          </p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate("/patient/hospitals")}>
            Browse Hospitals
          </button>
          <button type="button" className="btn-primary" onClick={() => navigate("/patient/appointments")}>
            Book Appointment
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/payments")}>
            Pay Bills
          </button>
        </div>
      </div>

      <section className="section">
        <h3>My Insurance Profile</h3>
        <div className="card premium-card">
          <div className="grid info-grid">
            <div>
              <strong>Provider</strong>
              <p className="muted">
                {profile?.insuranceProfile?.providerName || profile?.insuranceProfile?.providerCode || "Not set"}
              </p>
            </div>
            <div>
              <strong>Member Number</strong>
              <p className="muted">{profile?.insuranceProfile?.memberNumber || "Not set"}</p>
            </div>
            <div>
              <strong>Balance</strong>
              <p className="muted">
                {(profile?.insuranceProfile?.currency || "KES")} {Number(profile?.insuranceProfile?.balance || 0).toLocaleString()}
              </p>
            </div>
            <div>
              <strong>Status</strong>
              <p className="muted">{profile?.insuranceProfile?.status || "PENDING"}</p>
            </div>
          </div>
          <button type="button" className="btn-secondary" onClick={() => navigate("/profile")}>
            Update Insurance Profile
          </button>
        </div>
      </section>

      <section className="section">
        <h3>Hospitals on AfyaLink</h3>
        <div className="card premium-card">
          <label>Search hospital</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Hospital name, code or address"
          />
          {loading ? (
            <p className="muted">Loading hospitals...</p>
          ) : (
            <div className="table-wrap">
              <table className="table premium-table">
                <thead>
                  <tr>
                    <th>Hospital</th>
                    <th>Insurance</th>
                    <th>Payment Channels</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {hospitals.map((h) => (
                    <tr key={h._id}>
                      <td>
                        <strong>{h.name}</strong>
                        <div className="muted">{h.code || "—"} • {h.address || "No address"}</div>
                      </td>
                      <td>
                        {(h.insuranceProviders || []).length
                          ? h.insuranceProviders.map((p) => p.name || p.code).join(", ")
                          : "Not configured"}
                      </td>
                      <td>
                        {(h.patientPaymentMethods || []).length
                          ? h.patientPaymentMethods.map((m) => m.label || m.type).join(", ")
                          : "Not configured"}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button type="button" className="btn-secondary" onClick={() => navigate(`/patient/appointments?hospitalId=${h._id}`)}>
                            Book
                          </button>
                          <button type="button" className="btn-secondary" onClick={() => navigate(`/payments?hospitalId=${h._id}`)}>
                            Pay Bill
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {hospitals.length === 0 && (
                    <tr>
                      <td colSpan={4} className="muted">No hospitals found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
