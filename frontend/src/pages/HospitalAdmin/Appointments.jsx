import React from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { useHospitalAdminAppointments } from "../../hooks/useHospitalAdminAppointments";

export default function HospitalAdminAppointments() {
  const navigate = useNavigate();
  const {
    loading,
    savingAvailability,
    savingPolicy,
    msg,
    data,
    schedulingPolicy,
    setSchedulingPolicy,
    selectedDoctor,
    setSelectedDoctor,
    availabilityForm,
    setAvailabilityForm,
    queueSectionRef,
    availabilitySectionRef,
    scrollToSection,
    selectedDoctorData,
    assignDoctor,
    blockCall,
    removeCall,
    saveAvailability,
    saveSchedulingPolicy,
    dayNames,
    load,
  } = useHospitalAdminAppointments();

  const updatePolicyField = (field, value) => {
    setSchedulingPolicy((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Appointment Operations</h2>
          <p className="muted">Manage service bookings, clinician assignment, doctor load, schedules, and consultation calls.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-secondary" onClick={() => void load()} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {msg && <div className="card">{msg}</div>}

      <section className="section">
        <h3>Today</h3>
        <div className="grid info-grid">
          <StatCard title="Total appointments" value={data.summary.totalAppointments ?? 0} onClick={() => scrollToSection(queueSectionRef)} />
          <StatCard title="Waiting assignment" value={data.summary.pendingAssignments ?? 0} onClick={() => scrollToSection(queueSectionRef)} />
          <StatCard title="Assigned" value={data.summary.assignedToday ?? 0} onClick={() => scrollToSection(queueSectionRef)} />
          <StatCard title="Doctors online" value={data.summary.doctorsOnline ?? 0} onClick={() => scrollToSection(availabilitySectionRef)} />
          <StatCard title="Requested calls" value={data.calls.filter((call) => call.status === "REQUESTED").length} onClick={() => navigate("/hospital-admin/consultation-monitor?status=REQUESTED")} />
          <StatCard title="Active calls" value={data.calls.filter((call) => call.status === "ACTIVE").length} onClick={() => navigate("/hospital-admin/consultation-monitor?status=ACTIVE")} />
        </div>
      </section>

      <section className="section">
        <h3>Scheduling Policy</h3>
        <div className="card premium-card">
          <p className="muted" style={{ marginTop: 0 }}>
            Configure how this hospital accepts bookings, manages queue capacity, and assigns clinicians.
          </p>
          <div className="form-grid">
            <label>
              Booking horizon days
              <input
                type="number"
                min="1"
                max="365"
                value={schedulingPolicy.bookingHorizonDays}
                onChange={(e) => updatePolicyField("bookingHorizonDays", Number(e.target.value || 1))}
              />
            </label>
            <label>
              Cancellation cutoff hours
              <input
                type="number"
                min="0"
                max="720"
                value={schedulingPolicy.cancellationCutoffHours}
                onChange={(e) => updatePolicyField("cancellationCutoffHours", Number(e.target.value || 0))}
              />
            </label>
            <label>
              Daily doctor capacity
              <input
                type="number"
                min="1"
                max="200"
                value={schedulingPolicy.dailyDoctorCapacity}
                onChange={(e) => updatePolicyField("dailyDoctorCapacity", Number(e.target.value || 1))}
              />
            </label>
            <label>
              Maximum queue size
              <input
                type="number"
                min="1"
                max="10000"
                value={schedulingPolicy.maximumQueueSize}
                onChange={(e) => updatePolicyField("maximumQueueSize", Number(e.target.value || 1))}
              />
            </label>
            <label>
              Emergency slot percentage
              <input
                type="number"
                min="0"
                max="80"
                value={schedulingPolicy.emergencySlotPercentage}
                onChange={(e) => updatePolicyField("emergencySlotPercentage", Number(e.target.value || 0))}
              />
            </label>
            <label>
              Queue alert threshold
              <input
                type="number"
                min="1"
                max="10000"
                value={schedulingPolicy.queueAlertThreshold}
                onChange={(e) => updatePolicyField("queueAlertThreshold", Number(e.target.value || 1))}
              />
            </label>
          </div>
          <div className="doctor-actions-row" style={{ marginTop: 12, flexWrap: "wrap" }}>
            {[
              ["autoAssignmentEnabled", "Auto assignment"],
              ["workloadBalancingEnabled", "Workload balancing"],
              ["waitlistEnabled", "Waitlist"],
              ["prioritySchedulingEnabled", "Priority scheduling"],
              ["weekendBookingEnabled", "Weekend booking"],
            ].map(([field, label]) => (
              <label key={field} className="action-pill" style={{ cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={Boolean(schedulingPolicy[field])}
                  onChange={(e) => updatePolicyField(field, e.target.checked)}
                  style={{ marginRight: 8 }}
                />
                {label}
              </label>
            ))}
          </div>
          <button type="button" className="btn-primary" onClick={() => void saveSchedulingPolicy()} disabled={savingPolicy}>
            {savingPolicy ? "Saving..." : "Save Scheduling Policy"}
          </button>
        </div>
      </section>

      <section className="section doctor-main-grid" ref={queueSectionRef}>
        <div className="card doctor-schedule-card">
          <h3>Service Booking Queue</h3>
          {data.summary.pendingAssignments > 0 ? (
            <div className="appointment-lock-card" role="status" style={{ marginBottom: 12 }}>
              <strong>Capacity alert</strong>
              <p style={{ margin: "6px 0 0" }}>
                {data.summary.pendingAssignments} appointment{data.summary.pendingAssignments === 1 ? "" : "s"} need clinician assignment.
                Extend clinic hours, assign another doctor, or open another consultation room.
              </p>
            </div>
          ) : null}
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
                    <td>{item.doctor?.name || "Waiting for care team"}</td>
                    <td>
                      <select
                        value={item.doctor?._id || ""}
                        onChange={(e) => void assignDoctor(item._id, e.target.value)}
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
                  <button type="button" className="btn-secondary" onClick={() => void blockCall(call._id)}>
                    Block Call
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => void removeCall(call._id)}>
                    Archive
                  </button>
                </div>
              </div>
            ))}
            {data.calls.length === 0 && <div className="muted">No calls yet.</div>}
          </div>
        </div>
      </section>

      <section className="section" ref={availabilitySectionRef}>
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
                    <td>{dayNames[row.dayOfWeek] || row.dayOfWeek}</td>
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

          <button type="button" className="btn-primary" onClick={() => void saveAvailability()} disabled={savingAvailability}>
            {savingAvailability ? "Saving..." : "Save Availability"}
          </button>
        </div>
      </section>
    </div>
  );
}
