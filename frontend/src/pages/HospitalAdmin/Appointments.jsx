import React, { useEffect, useMemo, useState } from "react";
import apiFetch from "../../utils/apiFetch";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function defaultAvailabilityRows() {
  return [1, 2, 3, 4, 5].map((dayOfWeek) => ({
    dayOfWeek,
    startTime: "08:00",
    endTime: "17:00",
    appointmentSlots: 12,
    isAvailable: true,
    consultationAvailable: true,
    modes: {
      chat: true,
      voice: false,
      video: false,
      inPerson: true,
    },
    notes: "",
  }));
}

export default function HospitalAdminAppointments() {
  const [loading, setLoading] = useState(false);
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [msg, setMsg] = useState("");
  const [data, setData] = useState({
    summary: {},
    appointments: [],
    doctors: [],
    availability: [],
    calls: [],
  });
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [availabilityForm, setAvailabilityForm] = useState(defaultAvailabilityRows());

  const load = async () => {
    setLoading(true);
    setMsg("");
    try {
      const res = await apiFetch("/api/appointments/ops/queue");
      setData({
        summary: res?.summary || {},
        appointments: Array.isArray(res?.appointments) ? res.appointments : [],
        doctors: Array.isArray(res?.doctors) ? res.doctors : [],
        availability: Array.isArray(res?.availability) ? res.availability : [],
        calls: Array.isArray(res?.calls) ? res.calls : [],
      });
      if (!selectedDoctor && Array.isArray(res?.doctors) && res.doctors.length) {
        setSelectedDoctor(String(res.doctors[0]._id));
      }
    } catch (err) {
      setMsg(err?.message || "Failed to load appointment operations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const selectedDoctorData = useMemo(
    () => data.doctors.find((doc) => String(doc._id) === String(selectedDoctor)) || null,
    [data.doctors, selectedDoctor]
  );

  useEffect(() => {
    if (!selectedDoctor) {
      setAvailabilityForm(defaultAvailabilityRows());
      return;
    }
    const rows = data.availability
      .filter((row) => String(row.doctor) === String(selectedDoctor))
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek);
    setAvailabilityForm(rows.length ? rows : defaultAvailabilityRows());
  }, [selectedDoctor, data.availability]);

  const assignDoctor = async (appointmentId, doctorId) => {
    try {
      setMsg("");
      await apiFetch(`/api/appointments/${appointmentId}/assign`, {
        method: "POST",
        body: {
          doctorId: doctorId || undefined,
        },
      });
      await load();
      setMsg("Doctor assignment updated.");
    } catch (err) {
      setMsg(err?.message || "Failed to assign doctor");
    }
  };

  const blockCall = async (callId) => {
    try {
      setMsg("");
      await apiFetch(`/api/appointments/calls/${callId}/block`, {
        method: "PATCH",
        body: {
          reason: "Blocked by hospital admin",
        },
      });
      await load();
      setMsg("Call blocked.");
    } catch (err) {
      setMsg(err?.message || "Failed to block call");
    }
  };

  const removeCall = async (callId) => {
    try {
      setMsg("");
      await apiFetch(`/api/appointments/calls/${callId}`, {
        method: "DELETE",
      });
      await load();
      setMsg("Call record archived.");
    } catch (err) {
      setMsg(err?.message || "Failed to archive call");
    }
  };

  const saveAvailability = async () => {
    if (!selectedDoctor) {
      setMsg("Select a doctor first.");
      return;
    }
    setSavingAvailability(true);
    setMsg("");
    try {
      await apiFetch(`/api/appointments/doctors/${selectedDoctor}/availability`, {
        method: "PUT",
        body: {
          items: availabilityForm,
        },
      });
      await load();
      setMsg("Doctor availability saved.");
    } catch (err) {
      setMsg(err?.message || "Failed to save availability");
    } finally {
      setSavingAvailability(false);
    }
  };

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Appointment Operations</h2>
          <p className="muted">Manage hospital bookings, doctor load, schedules, and consultation calls.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {msg && <div className="card">{msg}</div>}

      <section className="section">
        <h3>Today</h3>
        <div className="grid info-grid">
          <div className="card"><strong>Total appointments</strong><div>{data.summary.totalAppointments ?? 0}</div></div>
          <div className="card"><strong>Pending assignments</strong><div>{data.summary.pendingAssignments ?? 0}</div></div>
          <div className="card"><strong>Assigned</strong><div>{data.summary.assignedToday ?? 0}</div></div>
          <div className="card"><strong>Doctors online</strong><div>{data.summary.doctorsOnline ?? 0}</div></div>
          <div className="card"><strong>Requested calls</strong><div>{data.calls.filter((call) => call.status === "REQUESTED").length}</div></div>
          <div className="card"><strong>Active calls</strong><div>{data.calls.filter((call) => call.status === "ACTIVE").length}</div></div>
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <h3>Appointment Queue</h3>
          <div className="table-wrap">
            <table className="table premium-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Patient</th>
                  <th>Service</th>
                  <th>Status</th>
                  <th>Doctor</th>
                  <th>Assign</th>
                </tr>
              </thead>
              <tbody>
                {data.appointments.map((item) => (
                  <tr key={item._id}>
                    <td>{item.scheduledAt ? new Date(item.scheduledAt).toLocaleString() : "—"}</td>
                    <td>
                      {item.patient?.firstName
                        ? `${item.patient.firstName} ${item.patient.lastName || ""}`.trim()
                        : item.patient?.name || "Patient"}
                    </td>
                    <td>{item.serviceType || "General Consultation"}</td>
                    <td>{item.assignmentStatus || item.status}</td>
                    <td>{item.doctor?.name || "Auto-pending"}</td>
                    <td>
                      <select
                        value={item.doctor?._id || ""}
                        onChange={(e) => assignDoctor(item._id, e.target.value)}
                      >
                        <option value="">Auto assign</option>
                        {data.doctors.map((doctor) => (
                          <option key={doctor._id} value={doctor._id}>
                            {doctor.name} {doctor?.employment?.department ? `• ${doctor.employment.department}` : ""}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
                {data.appointments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="muted">No appointments in queue.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card doctor-alerts-card">
          <h3>Call Control</h3>
          <div className="alert-stack">
            {data.calls.map((call) => (
              <div key={call._id} className="card" style={{ marginBottom: 8 }}>
                <div><strong>{call.callType}</strong> • {call.status}</div>
                <div className="muted">
                  Doctor: {call.doctor?.name || "—"} • Patient: {call.patient?.firstName || "—"}
                </div>
                <div className="muted">
                  Service: {call.appointment?.serviceType || "Consultation"} • Started:{" "}
                  {call.startedAt ? new Date(call.startedAt).toLocaleString() : "—"}
                </div>
                <div className="doctor-actions-row" style={{ marginTop: 8 }}>
                  <button type="button" className="btn-secondary" onClick={() => blockCall(call._id)}>
                    Block Call
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => removeCall(call._id)}>
                    Archive
                  </button>
                </div>
              </div>
            ))}
            {data.calls.length === 0 && <div className="muted">No calls yet.</div>}
          </div>
        </div>
      </section>

      <section className="section">
        <h3>Doctor Availability</h3>
        <div className="card premium-card">
          <label>Doctor</label>
          <select value={selectedDoctor} onChange={(e) => setSelectedDoctor(e.target.value)}>
            <option value="">Select doctor</option>
            {data.doctors.map((doctor) => (
              <option key={doctor._id} value={doctor._id}>
                {doctor.name} {doctor?.employment?.department ? `• ${doctor.employment.department}` : ""}
              </option>
            ))}
          </select>

          {selectedDoctorData && (
            <p className="muted" style={{ marginTop: 8 }}>
              Editing: {selectedDoctorData.name} • {selectedDoctorData?.employment?.department || selectedDoctorData.role}
            </p>
          )}

          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="table premium-table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Slots</th>
                  <th>Open</th>
                  <th>Consult</th>
                </tr>
              </thead>
              <tbody>
                {availabilityForm.map((row, index) => (
                  <tr key={`${row.dayOfWeek}-${index}`}>
                    <td>{DAY_NAMES[row.dayOfWeek] || row.dayOfWeek}</td>
                    <td>
                      <input
                        type="time"
                        value={row.startTime}
                        onChange={(e) =>
                          setAvailabilityForm((prev) =>
                            prev.map((item, i) => (i === index ? { ...item, startTime: e.target.value } : item))
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="time"
                        value={row.endTime}
                        onChange={(e) =>
                          setAvailabilityForm((prev) =>
                            prev.map((item, i) => (i === index ? { ...item, endTime: e.target.value } : item))
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        max="96"
                        value={row.appointmentSlots}
                        onChange={(e) =>
                          setAvailabilityForm((prev) =>
                            prev.map((item, i) =>
                              i === index ? { ...item, appointmentSlots: Number(e.target.value || 0) } : item
                            )
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={row.isAvailable !== false}
                        onChange={(e) =>
                          setAvailabilityForm((prev) =>
                            prev.map((item, i) => (i === index ? { ...item, isAvailable: e.target.checked } : item))
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={row.consultationAvailable !== false}
                        onChange={(e) =>
                          setAvailabilityForm((prev) =>
                            prev.map((item, i) =>
                              i === index ? { ...item, consultationAvailable: e.target.checked } : item
                            )
                          )
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button type="button" className="btn-primary" onClick={saveAvailability} disabled={savingAvailability}>
            {savingAvailability ? "Saving..." : "Save Availability"}
          </button>
        </div>
      </section>
    </div>
  );
}
