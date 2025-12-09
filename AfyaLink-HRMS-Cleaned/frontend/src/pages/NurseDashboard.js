import React, { useEffect, useState } from "react";

export default function NurseDashboard({ api, token }) {
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    fetchPatients();
    fetchAppointments();
    fetchTasks();
  }, []);

  const fetchPatients = async () => {
    try {
      const res = await fetch(`${api}/nurse/patients`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setPatients(data);
    } catch (err) {
      console.error("Error fetching patients:", err);
    }
  };

  const fetchAppointments = async () => {
    try {
      const res = await fetch(`${api}/nurse/appointments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setAppointments(data);
    } catch (err) {
      console.error("Error fetching appointments:", err);
    }
  };

  const fetchTasks = async () => {
    try {
      const res = await fetch(`${api}/nurse/tasks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setTasks(data);
    } catch (err) {
      console.error("Error fetching tasks:", err);
    }
  };

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
                <th>Ward/Room</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.id}>
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

      {/* Appointments Support */}
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
                <tr key={appt.id}>
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

      {/* Medical Tasks */}
      <section style={styles.section}>
        <h2>📝 Tasks & Records ({tasks.length})</h2>
        {tasks.length === 0 ? (
          <p>No tasks assigned</p>
        ) : (
          <ul>
            {tasks.map((t) => (
              <li key={t.id}>
                {t.date} - {t.patientName}: {t.description}
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
  table: { width: "100%", borderCollapse: "collapse", marginTop: "10px" },
};
