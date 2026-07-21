import React, { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { usePatientHospitals } from "../../hooks/usePatientHospitals";

const SELECTED_HOSPITAL_KEY = "afyalink_patient_hospital_id";
const PATIENT_LOCATION_KEY = "afyalink_patient_location_v1";

export default function PatientHospitals() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") || "");
  const savedLocation = (() => {
    try {
      return JSON.parse(localStorage.getItem(PATIENT_LOCATION_KEY) || "{}");
    } catch {
      return {};
    }
  })();

  const [lat, setLat] = useState(savedLocation?.lat ?? "");
  const [lng, setLng] = useState(savedLocation?.lng ?? "");
  const [radiusKm, setRadiusKm] = useState(savedLocation?.radiusKm ?? 100);
  const [locating, setLocating] = useState(false);
  const { items, loading, msg, setMsg, selectedHospitalId, setSelectedHospitalId, selectedHospital, selectHospital } = usePatientHospitals({ q, lat, lng, radiusKm });

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setMsg("Geolocation is not available in this browser.");
      return;
    }
    setLocating(true);
    setMsg("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(String(pos.coords.latitude));
        setLng(String(pos.coords.longitude));
        setLocating(false);
      },
      () => {
        setMsg("Could not read your current location. Enter coordinates manually.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Hospitals Near You</h2>
          <p className="muted">
            Choose your location first. AfyaLink lists nearby hospitals so you can pick your preferred one.
          </p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-secondary" onClick={useCurrentLocation} disabled={locating}>
            {locating ? "Detecting..." : "Use Current Location"}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!selectedHospitalId}
            onClick={() => navigate(`/patient/appointments?hospitalId=${selectedHospitalId}`)}
          >
            Book Appointment
          </button>
        </div>
      </div>

      {msg && <div className="card">{msg}</div>}

      <section className="section">
        <div className="card premium-card">
          <label>Latitude</label>
          <input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="-1.286389" />

          <label>Longitude</label>
          <input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="36.817223" />

          <label>Radius (km)</label>
          <input type="number" min={1} max={500} value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value || 100))} />

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
                    <th>Distance</th>
                    <th>Insurance</th>
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
                      <td>{Number.isFinite(Number(h.distanceKm)) ? `${Number(h.distanceKm).toFixed(1)} km` : "—"}</td>
                      <td>
                        {(h.insuranceProviders || []).length
                          ? h.insuranceProviders.map((i) => i.name || i.code).join(", ")
                          : "Not configured"}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => selectHospital(h._id)}
                          >
                            {String(selectedHospitalId) === String(h._id) ? "Selected" : "Select"}
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => navigate(`/patient/appointments?hospitalId=${h._id}`)}
                          >
                            Book
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
