import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import apiFetch from "../../utils/apiFetch";
import ConsultationRoom from "../../components/ConsultationRoom";

const SELECTED_HOSPITAL_KEY = "afyalink_patient_hospital_id";
const PATIENT_LOCATION_KEY = "afyalink_patient_location_v1";

export default function MyAppointments() {
  const [searchParams] = useSearchParams();
  const hospitalFromQuery = searchParams.get("hospitalId") || "";
  const savedLocation = (() => {
    try {
      return JSON.parse(localStorage.getItem(PATIENT_LOCATION_KEY) || "{}");
    } catch {
      return {};
    }
  })();

  const [hospitalId, setHospitalId] = useState(
    () => hospitalFromQuery || localStorage.getItem(SELECTED_HOSPITAL_KEY) || ""
  );
  const [hospitals, setHospitals] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [calls, setCalls] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [callMsg, setCallMsg] = useState("");
  const [activeCall, setActiveCall] = useState(null);
  const [doctorSearch, setDoctorSearch] = useState("");
  const [locationMode, setLocationMode] = useState(savedLocation?.mode || "manual");
  const [lat, setLat] = useState(savedLocation?.lat ?? "");
  const [lng, setLng] = useState(savedLocation?.lng ?? "");
  const [radiusKm, setRadiusKm] = useState(savedLocation?.radiusKm ?? 100);
  const [locationLabel, setLocationLabel] = useState(savedLocation?.label || "");
  const [locating, setLocating] = useState(false);
  const [form, setForm] = useState({
    scheduledAt: "",
    reason: "",
    doctor: "",
    serviceType: "General Consultation",
    consultationMode: "IN_PERSON",
  });

  const selectedHospital = useMemo(
    () => hospitals.find((h) => String(h._id) === String(hospitalId)) || null,
    [hospitals, hospitalId]
  );

  const filteredDoctors = useMemo(() => {
    const q = doctorSearch.trim().toLowerCase();
    if (!q) return doctors;
    return doctors.filter((d) => {
      const name = String(d?.name || "").toLowerCase();
      const email = String(d?.email || "").toLowerCase();
      const dept = String(d?.employment?.department || "").toLowerCase();
      return name.includes(q) || email.includes(q) || dept.includes(q);
    });
  }, [doctors, doctorSearch]);

  const locationReady = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));

  const loadHospitals = async () => {
    if (!locationReady) {
      setHospitals([]);
      setHospitalId("");
      return;
    }
    try {
      const data = await apiFetch(
        `/api/hospitals/marketplace?limit=100&lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(
          lng
        )}&radiusKm=${encodeURIComponent(radiusKm)}`
      );
      const rows = Array.isArray(data?.items) ? data.items : [];
      setHospitals(rows);
      if (!hospitalId && rows.length) {
        const id = String(rows[0]._id);
        setHospitalId(id);
        localStorage.setItem(SELECTED_HOSPITAL_KEY, id);
      }
    } catch {
      setHospitals([]);
    }
  };

  const loadAppointments = async () => {
    if (!hospitalId) {
      setAppointments([]);
      return;
    }
    setLoading(true);
    setMsg("");
    try {
      const data = await apiFetch(`/api/appointments?hospitalId=${hospitalId}&limit=50`);
      const rows = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      setAppointments(rows);
    } catch (e) {
      setAppointments([]);
      setMsg(e?.message || "Failed to load appointments");
    } finally {
      setLoading(false);
    }
  };

  const loadDoctors = async () => {
    if (!hospitalId) {
      setDoctors([]);
      return;
    }
    try {
      const data = await apiFetch(`/api/appointments/doctors?hospitalId=${encodeURIComponent(hospitalId)}`);
      setDoctors(Array.isArray(data?.items) ? data.items : []);
    } catch {
      setDoctors([]);
    }
  };

  const loadCalls = async () => {
    if (!hospitalId) {
      setCalls([]);
      return;
    }
    try {
      const data = await apiFetch(`/api/appointments/calls?hospitalId=${encodeURIComponent(hospitalId)}`);
      setCalls(Array.isArray(data?.items) ? data.items : []);
    } catch {
      setCalls([]);
    }
  };

  const loadSuggestions = async () => {
    if (!hospitalId || !form.serviceType) {
      setSuggestions([]);
      return;
    }
    try {
      const params = new URLSearchParams({
        hospitalId: String(hospitalId),
        serviceType: String(form.serviceType || "General Consultation"),
        consultationMode: String(form.consultationMode || "IN_PERSON"),
        limit: "4",
      });
      if (form.scheduledAt) {
        params.set("preferredDate", new Date(form.scheduledAt).toISOString());
      }
      const data = await apiFetch(`/api/appointments/suggestions?${params.toString()}`);
      setSuggestions(Array.isArray(data?.items) ? data.items : []);
    } catch {
      setSuggestions([]);
    }
  };

  useEffect(() => {
    if (!locationReady) return;
    loadHospitals();
  }, [lat, lng, radiusKm]);

  useEffect(() => {
    if (!hospitalId) return;
    localStorage.setItem(SELECTED_HOSPITAL_KEY, hospitalId);
    setDoctorSearch("");
    loadDoctors();
    loadAppointments();
    loadCalls();
  }, [hospitalId]);

  useEffect(() => {
    if (!hospitalId) return undefined;
    const timer = setInterval(() => {
      loadAppointments();
      loadCalls();
    }, 15000);
    return () => clearInterval(timer);
  }, [hospitalId]);

  useEffect(() => {
    if (!hospitalId) return;
    loadSuggestions();
  }, [hospitalId, form.serviceType, form.consultationMode, form.scheduledAt]);

  useEffect(() => {
    if (!form.doctor) return;
    if (!doctors.some((d) => String(d._id) === String(form.doctor))) {
      setForm((p) => ({ ...p, doctor: "" }));
    }
  }, [doctors]);

  useEffect(() => {
    localStorage.setItem(
      PATIENT_LOCATION_KEY,
      JSON.stringify({
        mode: locationMode,
        lat,
        lng,
        radiusKm,
        label: locationLabel,
      })
    );
  }, [locationMode, lat, lng, radiusKm, locationLabel]);

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
        setLocationMode("gps");
        setLocationLabel("Current location");
        setLocating(false);
      },
      () => {
        setMsg("Could not read your current location. Enter coordinates manually.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!locationReady) {
      setMsg("Choose location first to find nearby hospitals.");
      return;
    }
    if (!hospitalId || !form.scheduledAt) {
      setMsg("Select hospital and date/time");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      await apiFetch("/api/appointments", {
        method: "POST",
        body: {
          hospitalId,
          scheduledAt: form.scheduledAt,
          reason: form.reason || undefined,
          serviceType: form.serviceType,
          consultationMode: form.consultationMode,
          doctor: form.doctor || undefined,
        },
      });
      setForm({
        scheduledAt: "",
        reason: "",
        doctor: "",
        serviceType: "General Consultation",
        consultationMode: "IN_PERSON",
      });
      setMsg("Appointment request submitted.");
      await loadAppointments();
    } catch (e2) {
      setMsg(e2?.message || "Failed to create appointment");
    } finally {
      setSaving(false);
    }
  };

  const bookSuggestedSlot = async (suggestion) => {
    const slotDate = suggestion?.appointmentTime ? new Date(suggestion.appointmentTime) : null;
    if (!hospitalId || !slotDate || Number.isNaN(slotDate.getTime())) {
      setMsg("Suggested slot is not ready.");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      await apiFetch("/api/appointments", {
        method: "POST",
        body: {
          hospitalId,
          doctor: suggestion.doctorId,
          scheduledAt: slotDate.toISOString(),
          serviceType: form.serviceType,
          consultationMode: form.consultationMode,
          reason: form.reason || undefined,
        },
      });
      setMsg("Suggested slot booked.");
      await loadAppointments();
    } catch (err) {
      setMsg(err?.message || "Failed to book suggested slot");
    } finally {
      setSaving(false);
    }
  };

  const startConsultation = async (appointmentId, callType) => {
    setCallMsg("");
    try {
      await apiFetch("/api/appointments/calls", {
        method: "POST",
        body: {
          hospitalId,
          appointmentId,
          callType,
        },
      });
      setCallMsg(`${callType === "VIDEO" ? "Video" : "Voice"} consultation request sent.`);
      await loadCalls();
    } catch (err) {
      setCallMsg(err?.message || "Could not start consultation request");
    }
  };

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>My Appointments</h2>
          <p className="muted">Choose your location first, then book in the nearest hospital.</p>
        </div>
      </div>

      {msg && <div className="card">{msg}</div>}
      {callMsg && <div className="card">{callMsg}</div>}
      {activeCall && (
        <ConsultationRoom
          call={activeCall}
          role="PATIENT"
          onClose={() => setActiveCall(null)}
        />
      )}

      <section className="section">
        <div className="card premium-card">
          <h3>1) Choose Location</h3>
          <label>Location mode</label>
          <select
            value={locationMode}
            onChange={(e) => setLocationMode(e.target.value)}
            data-ai-label="Location Mode"
            data-ai-aliases="location source|gps mode|manual coordinates mode"
            data-ai-priority="low"
          >
            <option value="manual">Manual Coordinates</option>
            <option value="gps">Use Current GPS</option>
          </select>

          {locationMode === "gps" && (
            <button type="button" className="btn-secondary" onClick={useCurrentLocation} disabled={locating}>
              {locating ? "Detecting..." : "Use Current Location"}
            </button>
          )}

          <label>Latitude</label>
          <input
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            placeholder="-1.286389"
            data-ai-label="Latitude"
            data-ai-aliases="current latitude|patient latitude|location latitude"
            data-ai-priority="low"
          />

          <label>Longitude</label>
          <input
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            placeholder="36.817223"
            data-ai-label="Longitude"
            data-ai-aliases="current longitude|patient longitude|location longitude"
            data-ai-priority="low"
          />

          <label>Search radius (km)</label>
          <input
            type="number"
            min={1}
            max={500}
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value || 100))}
            data-ai-label="Search Radius (km)"
            data-ai-aliases="radius|distance radius|hospital search radius"
            data-ai-priority="low"
          />

          <label>Location label (optional)</label>
          <input
            value={locationLabel}
            onChange={(e) => setLocationLabel(e.target.value)}
            placeholder="Nairobi CBD"
            data-ai-label="Location Label"
            data-ai-aliases="area label|location name|patient area"
            data-ai-priority="low"
          />
        </div>
      </section>

      <section className="section">
        <div className="card premium-card">
          <h3>2) Select Nearest Hospital</h3>
          <label>Hospital</label>
          <select
            value={hospitalId}
            onChange={(e) => setHospitalId(e.target.value)}
            disabled={!locationReady}
            data-ai-label="Nearest Hospital"
            data-ai-aliases="hospital|selected hospital|booking hospital|facility"
            data-ai-widget="hospital-picker"
            data-ai-priority="high"
          >
            <option value="">{locationReady ? "Select nearest hospital" : "Choose location first"}</option>
            {hospitals.map((h) => (
              <option key={h._id} value={h._id}>
                {h.name} {Number.isFinite(Number(h.distanceKm)) ? `• ${Number(h.distanceKm).toFixed(1)} km` : ""}
              </option>
            ))}
          </select>
          {selectedHospital ? (
            <p className="muted" style={{ marginTop: 8 }}>
              Using: {selectedHospital.name}
              {Number.isFinite(Number(selectedHospital.distanceKm))
                ? ` (${Number(selectedHospital.distanceKm).toFixed(1)} km away)`
                : ""}
            </p>
          ) : null}
        </div>
      </section>

      <section className="section">
        <h3>3) Book Appointment</h3>
        <form className="card premium-card" onSubmit={submit}>
          <label>Service</label>
          <select
            value={form.serviceType}
            onChange={(e) => setForm((p) => ({ ...p, serviceType: e.target.value }))}
            data-ai-label="Appointment Service"
            data-ai-aliases="service type|consultation service|clinic service"
            data-ai-priority="high"
          >
            <option value="General Consultation">General Consultation</option>
            <option value="Outpatient Review">Outpatient Review</option>
            <option value="Paediatrics">Paediatrics</option>
            <option value="Antenatal Care">Antenatal Care</option>
            <option value="Cardiology">Cardiology</option>
            <option value="Surgery Review">Surgery Review</option>
            <option value="Physiotherapy">Physiotherapy</option>
            <option value="Mental Health">Mental Health</option>
          </select>
          <label>Date & Time</label>
          <input
            type="datetime-local"
            value={form.scheduledAt}
            onChange={(e) => setForm((p) => ({ ...p, scheduledAt: e.target.value }))}
            required
            data-ai-label="Appointment Date & Time"
            data-ai-aliases="appointment time|scheduled time|booking date and time"
            data-ai-priority="high"
          />
          <label>Consultation type</label>
          <select
            value={form.consultationMode}
            onChange={(e) => setForm((p) => ({ ...p, consultationMode: e.target.value }))}
            data-ai-label="Consultation Type"
            data-ai-aliases="consultation mode|appointment mode|visit mode"
            data-ai-priority="high"
          >
            <option value="IN_PERSON">In person</option>
            <option value="CHAT">Chat</option>
            <option value="VOICE">Voice call</option>
            <option value="VIDEO">Video call</option>
          </select>
          <label>Reason</label>
          <input
            value={form.reason}
            onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
            placeholder="Consultation reason"
            data-ai-label="Appointment Reason"
            data-ai-aliases="consultation reason|visit reason|chief complaint"
            data-ai-priority="high"
          />
          <label>Preferred doctor (optional)</label>
          <input
            value={doctorSearch}
            onChange={(e) => setDoctorSearch(e.target.value)}
            placeholder="Search doctor by name, email or department"
            data-ai-label="Doctor Search"
            data-ai-aliases="doctor lookup|find doctor|preferred doctor search"
            data-ai-intent="lookup"
            data-ai-priority="medium"
          />
          <select
            value={form.doctor}
            onChange={(e) => setForm((p) => ({ ...p, doctor: e.target.value }))}
            data-ai-label="Preferred Doctor"
            data-ai-aliases="doctor|selected doctor|assigned doctor"
            data-ai-widget="doctor-picker"
            data-ai-priority="high"
          >
            <option value="">Any available doctor</option>
            {filteredDoctors.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name} {d?.employment?.department ? `• ${d.employment.department}` : ""}
              </option>
            ))}
          </select>
          <p className="muted" style={{ marginTop: 6 }}>
            The hospital will assign the best available doctor if you leave this blank.
          </p>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Submitting..." : "Submit Appointment"}
          </button>
        </form>
      </section>

      <section className="section">
        <h3>Best Next Slots</h3>
        <div className="grid info-grid">
          {suggestions.map((item, index) => (
            <div key={`${item.doctorId}-${index}`} className="card premium-card">
              <h4 style={{ marginTop: 0 }}>{item.doctorName}</h4>
              <p className="muted">{item.specialization || "General Consultation"}</p>
              <div className="action-pill">
                {item.appointmentTime ? new Date(item.appointmentTime).toLocaleString() : "No slot"}
              </div>
              <button
                type="button"
                className="btn-secondary"
                style={{ marginTop: 12 }}
                onClick={() => {
                  const slotDate = item.appointmentTime ? new Date(item.appointmentTime) : null;
                  const localValue =
                    slotDate && !Number.isNaN(slotDate.getTime())
                      ? new Date(slotDate.getTime() - slotDate.getTimezoneOffset() * 60000)
                          .toISOString()
                          .slice(0, 16)
                      : "";
                  setForm((prev) => ({
                    ...prev,
                    doctor: item.doctorId,
                    scheduledAt: localValue || prev.scheduledAt,
                  }));
                }}
              >
                Use This Slot
              </button>
              <button
                type="button"
                className="btn-primary"
                style={{ marginTop: 8 }}
                disabled={saving}
                onClick={() => bookSuggestedSlot(item)}
              >
                {saving ? "Booking..." : "Book Now"}
              </button>
            </div>
          ))}
          {!suggestions.length && (
            <div className="card premium-card">
              <p className="muted">No smart slot suggestions yet. Pick a time manually.</p>
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <h3>Doctors In This Hospital</h3>
        <div className="grid info-grid">
          {filteredDoctors.slice(0, 8).map((doctor) => (
            <div key={doctor._id} className="card premium-card">
              <h4 style={{ marginTop: 0 }}>{doctor.name}</h4>
              <p className="muted" style={{ marginBottom: 8 }}>
                {doctor.specialization || doctor?.employment?.department || "General Practice"}
              </p>
              <div className="action-pill">Today: {doctor.availableToday ? "Available" : "Busy"}</div>
              <div className="action-pill">
                Consult: {doctor.consultationAvailable ? "Open" : "Closed"}
              </div>
              <div className="action-pill">Status: {doctor.doctorStatus || "ONLINE"}</div>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setForm((p) => ({ ...p, doctor: doctor._id }))}
                style={{ marginTop: 12 }}
              >
                Prefer This Doctor
              </button>
            </div>
          ))}
          {!filteredDoctors.length && (
            <div className="card premium-card">
              <p className="muted">No doctors listed for this hospital yet.</p>
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <h3>Consultation Calls</h3>
        <div className="grid info-grid">
          {calls.map((call) => (
            <div key={call._id} className="card premium-card">
              <h4 style={{ marginTop: 0 }}>
                {call.callType === "VIDEO" ? "Video" : "Voice"} Consultation
              </h4>
              <p className="muted">
                Status: {call.status} • Doctor: {call.doctor?.name || "Assigned doctor"}
              </p>
              <p className="muted">
                Service: {call.appointment?.serviceType || "Consultation"}
              </p>
              <div className="doctor-actions-row">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={call.status !== "ACTIVE"}
                  onClick={() => setActiveCall(call)}
                >
                  {call.status === "ACTIVE" ? "Join Room" : "Waiting"}
                </button>
              </div>
            </div>
          ))}
          {!calls.length && (
            <div className="card premium-card">
              <p className="muted">No consultation calls yet.</p>
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <h3>Appointment History</h3>
        <div className="card premium-card">
          {loading ? (
            <p className="muted">Loading...</p>
          ) : (
            <div className="table-wrap">
              <table className="table premium-table">
                <thead>
                  <tr>
                    <th>Scheduled At</th>
                    <th>Status</th>
                    <th>Service</th>
                    <th>Reason</th>
                    <th>Doctor</th>
                    <th>Notes</th>
                    <th>Call</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((a) => (
                    <tr key={a._id}>
                      <td>{a.scheduledAt ? new Date(a.scheduledAt).toLocaleString() : "—"}</td>
                      <td>{a.status || "Scheduled"}</td>
                      <td>{a.serviceType || "General Consultation"}</td>
                      <td>{a.reason || "—"}</td>
                      <td>{a.doctor?.name || a.doctor || "Unassigned"}</td>
                      <td>
                        {a.notes
                          ? `${String(a.notes).slice(0, 100)}${String(a.notes).length > 100 ? "..." : ""}`
                          : a?.metadata?.followUpRequired
                          ? "Follow-up planned"
                          : "—"}
                        {a?.metadata?.consultationSummary?.diagnosis ? (
                          <div className="muted" style={{ marginTop: 4 }}>
                            Dx: {a.metadata.consultationSummary.diagnosis}
                          </div>
                        ) : null}
                        {a?.metadata?.consultationSummary?.followUpDate ? (
                          <div className="muted">
                            Follow-up: {new Date(a.metadata.consultationSummary.followUpDate).toLocaleDateString()}
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <div className="doctor-actions-row">
                          <button
                            type="button"
                            className="btn-secondary"
                            disabled={!a.doctor}
                            onClick={() => startConsultation(a._id, "VOICE")}
                          >
                            Voice
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            disabled={!a.doctor}
                            onClick={() => startConsultation(a._id, "VIDEO")}
                          >
                            Video
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {appointments.length === 0 && (
                    <tr>
                      <td colSpan={7} className="muted">No appointments yet.</td>
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
