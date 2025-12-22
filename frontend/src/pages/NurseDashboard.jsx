import React, { useEffect, useState } from "react";
import { apiFetch } from "../../utils/apiFetch";

export default function NurseDashboard() {
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  /* --------------------------------------------------
     LOAD ALL DATA
  -------------------------------------------------- */
  const loadAll = async () => {
    setLoading(true);
    setErr("");

    try {
      const [patientsRes, apptsRes, tasksRes] = await Promise.all([
        apiFetch("/api/nurse/patients"),
        apiFetch("/api/nurse/appointments"),
        apiFetch("/api/nurse/tasks"),
      ]);

      if (!patientsRes.ok || !apptsRes.ok || !tasksRes.ok) {
        throw new Error("Failed to load nurse data");
      }

      const [patientsData, apptsData, tasksData] = await Promise.all([
        patientsRes.json(),
        apptsRes.json(),
        tasksRes.json(),
      ]);

      setPatients(patientsData);
      setAppointments(apptsData);
      setTasks(tasksData);
    } catch (e) {
      setErr(e.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  if (loading) return <p>Loading nurse dashboard...</p>;
  if (err) return <p style={{ color: "red" }}>{err}</p>;

  return (
    <div>
      <h1>🩺 Nurse Dashboard</h1>

      {/* Assigned Patients */}
      <section style={styles.section}>
        <h2>🧾 Assigned Patients ({patients.length})</h2>
        {patients.length === 0 ? (
          <p>No patients assigned yet</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Age</th>
                <th>Gender</th>
                <th>Ward / Room</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p._id || p.id}>
                  <td>{p.name}</td>
                  <td>{p.age}</td>
                  <td>{p.gender}</td>
                  <td>{p.room || "N/A"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Appointments */}
      <section style={styles.section}>
        <h2>📅 Upcoming Appointments ({appointments.length})</h2>
        {appointments.length === 0 ? (
          <p>No upcoming appointments</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Patient</th>
                <th>Doctor</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((appt) => (
                <tr key={appt._id || appt.id}>
                  <td>{new Date(appt.date).toLocaleDateString()}</td>
                  <td>{appt.patientName}</td>
                  <td>{appt.doctorName}</td>
                  <td>{appt.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Tasks */}
      <section style={styles.section}>
        <h2>📝 Tasks & Records ({tasks.length})</h2>
        {tasks.length === 0 ? (
          <p>No tasks assigned</p>
        ) : (
          <ul>
            {tasks.map((t) => (
              <li key={t._id || t.id}>
                {new Date(t.date).toLocaleDateString()} —{" "}
                <strong>{t.patientName}</strong>: {t.description}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const styles = {
  section: { marginBottom: "30px" },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: "10px",
  },
};
