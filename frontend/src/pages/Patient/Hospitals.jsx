import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import apiFetch from "../../utils/apiFetch";

const SELECTED_HOSPITAL_KEY = "afyalink_patient_hospital_id";

export default function PatientHospitals() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") || "");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState(
    () => localStorage.getItem(SELECTED_HOSPITAL_KEY) || ""
  );

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/hospitals/marketplace?q=${encodeURIComponent(q)}&limit=100`);
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [q]);

  const selectedHospital = useMemo(
    () => items.find((h) => String(h._id) === String(selectedHospitalId)) || null,
    [items, selectedHospitalId]
  );

  const selectHospital = (id) => {
    setSelectedHospitalId(id);
    localStorage.setItem(SELECTED_HOSPITAL_KEY, String(id));
  };

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Hospitals</h2>
          <p className="muted">
            Search hospitals, select one, then book appointments and pay bills in that hospital context.
          </p>
        </div>
        <div className="welcome-actions">
          <button
            className="btn-primary"
            disabled={!selectedHospitalId}
            onClick={() => navigate(`/patient/appointments?hospitalId=${selectedHospitalId}`)}
          >
            Book Appointment
          </button>
          <button
            className="btn-secondary"
            disabled={!selectedHospitalId}
            onClick={() => navigate(`/payments?hospitalId=${selectedHospitalId}`)}
          >
            Pay Bills
          </button>
        </div>
      </div>

      <section className="section">
        <div className="card premium-card">
          <label>Search hospitals</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Hospital name, code, address"
          />

          {selectedHospital && (
            <div className="subtle-banner" style={{ marginTop: 10 }}>
              Selected hospital: <strong>{selectedHospital.name}</strong>
            </div>
          )}

          {loading ? (
            <p className="muted">Loading hospitals...</p>
          ) : (
            <div className="table-wrap" style={{ marginTop: 12 }}>
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
                  {items.map((h) => (
                    <tr key={h._id}>
                      <td>
                        <strong>{h.name}</strong>
                        <div className="muted">{h.code || "—"} • {h.address || "No address"}</div>
                      </td>
                      <td>
                        {(h.insuranceProviders || []).length
                          ? h.insuranceProviders.map((i) => i.name || i.code).join(", ")
                          : "Not configured"}
                      </td>
                      <td>
                        {(h.patientPaymentMethods || []).length
                          ? h.patientPaymentMethods.map((m) => m.label || m.type).join(", ")
                          : "Not configured"}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="btn-secondary"
                            onClick={() => selectHospital(h._id)}
                          >
                            {String(selectedHospitalId) === String(h._id) ? "Selected" : "Select"}
                          </button>
                          <button
                            className="btn-secondary"
                            onClick={() => navigate(`/patient/appointments?hospitalId=${h._id}`)}
                          >
                            Book
                          </button>
                          <button
                            className="btn-secondary"
                            onClick={() => navigate(`/payments?hospitalId=${h._id}`)}
                          >
                            Pay
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
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
