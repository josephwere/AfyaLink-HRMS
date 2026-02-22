import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import apiFetch from "../../utils/apiFetch";

const SELECTED_HOSPITAL_KEY = "afyalink_patient_hospital_id";

export default function MyAppointments() {
  const [searchParams] = useSearchParams();
  const hospitalFromQuery = searchParams.get("hospitalId") || "";
  const [hospitalId, setHospitalId] = useState(
    () => hospitalFromQuery || localStorage.getItem(SELECTED_HOSPITAL_KEY) || ""
  );
  const [hospitals, setHospitals] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [doctorSearch, setDoctorSearch] = useState("");
  const [form, setForm] = useState({ scheduledAt: "", reason: "", doctor: "" });

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

  const loadHospitals = async () => {
    try {
      const data = await apiFetch("/api/hospitals/marketplace?limit=100");
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

  useEffect(() => {
    loadHospitals();
  }, []);

  useEffect(() => {
    if (!hospitalId) return;
    localStorage.setItem(SELECTED_HOSPITAL_KEY, hospitalId);
    setDoctorSearch("");
    loadDoctors();
    loadAppointments();
  }, [hospitalId]);

  useEffect(() => {
    if (!form.doctor) return;
    if (!doctors.some((d) => String(d._id) === String(form.doctor))) {
      setForm((p) => ({ ...p, doctor: "" }));
    }
  }, [doctors]);

  const submit = async (e) => {
    e.preventDefault();
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
          doctor: form.doctor || undefined,
        },
      });
      setForm({ scheduledAt: "", reason: "", doctor: "" });
      setMsg("Appointment request submitted.");
      await loadAppointments();
    } catch (e2) {
      setMsg(e2?.message || "Failed to create appointment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>My Appointments</h2>
          <p className="muted">Book and manage appointments in your selected hospital.</p>
        </div>
      </div>

      {msg && <div className="card">{msg}</div>}

      <section className="section">
        <div className="card premium-card">
          <label>Hospital</label>
          <select
            value={hospitalId}
            onChange={(e) => setHospitalId(e.target.value)}
          >
            <option value="">Select hospital</option>
            {hospitals.map((h) => (
              <option key={h._id} value={h._id}>
                {h.name} ({h.code || "—"})
              </option>
            ))}
          </select>
          {selectedHospital ? (
            <p className="muted" style={{ marginTop: 8 }}>
              Using: {selectedHospital.name}
            </p>
          ) : null}
        </div>
      </section>

      <section className="section">
        <h3>Book Appointment</h3>
        <form className="card premium-card" onSubmit={submit}>
          <label>Date & Time</label>
          <input
            type="datetime-local"
            value={form.scheduledAt}
            onChange={(e) => setForm((p) => ({ ...p, scheduledAt: e.target.value }))}
            required
          />
          <label>Reason</label>
          <input
            value={form.reason}
            onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
            placeholder="Consultation reason"
          />
          <label>Doctor (optional)</label>
          <input
            value={doctorSearch}
            onChange={(e) => setDoctorSearch(e.target.value)}
            placeholder="Search doctor by name, email or department"
          />
          <select
            value={form.doctor}
            onChange={(e) => setForm((p) => ({ ...p, doctor: e.target.value }))}
          >
            <option value="">Any available doctor</option>
            {filteredDoctors.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name} {d?.employment?.department ? `• ${d.employment.department}` : ""}
              </option>
            ))}
          </select>
          <p className="muted" style={{ marginTop: 6 }}>
            Showing {filteredDoctors.length} of {doctors.length} doctors
          </p>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Submitting..." : "Submit Appointment"}
          </button>
        </form>
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
                    <th>Reason</th>
                    <th>Doctor</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((a) => (
                    <tr key={a._id}>
                      <td>{a.scheduledAt ? new Date(a.scheduledAt).toLocaleString() : "—"}</td>
                      <td>{a.status || "Scheduled"}</td>
                      <td>{a.reason || "—"}</td>
                      <td>{a.doctor?.name || a.doctor || "Unassigned"}</td>
                    </tr>
                  ))}
                  {appointments.length === 0 && (
                    <tr>
                      <td colSpan={4} className="muted">No appointments yet.</td>
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
