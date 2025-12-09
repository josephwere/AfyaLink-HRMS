import React, { useEffect, useState } from "react";

export default function DoctorDashboard({ api, token }) {
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [labRequests, setLabRequests] = useState([]);
  const [reports, setReports] = useState([]);

  useEffect(() => {
    fetchPatients();
    fetchAppointments();
    fetchLabRequests();
    fetchReports();
  }, []);

  const fetchPatients = async () => {
    try {
      const res = await fetch(`${api}/doctor/patients`, {
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
      const res = await fetch(`${api}/doctor/appointments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setAppointments(data);
    } catch (err) {
      console.error("Error fetching appointments:", err);
    }
  };

  const fetchLabRequests = async () => {
    try {
      const res = await fetch(`${api}/doctor/lab-requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setLabRequests(data);
    } catch (err) {
      console.error("Error fetching lab requests:", err);
    }
  };

  const fetchReports = async () => {
    try {
      const res = await fetch(`${api}/doctor/reports`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setReports(data);
    } catch (err) {
      console.error("Error fetching reports:", err);
    }
  };

  return (
    <div>
      <h1>🩺 Doctor Dashboard</h1>

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
                <th>Last Visit</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.age}</td>
                  <td>{p.gender}</td>
                  <td>{new Date(p.lastVisit).toLocaleDateString()}</td>
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
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((appt) => (
                <tr key={appt.id}>
                  <td>{new Date(appt.date).toLocaleDateString()}</td>
                  <td>{appt.patientName}</td>
                  <td>{appt.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Lab Requests */}
      <section style={styles.section}>
        <h2>🧪 Lab Requests ({labRequests.length})</h2>
        {labRequests.length === 0 ? (
          <p>No lab requests yet</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th>Patient</th>
                <th>Test</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {labRequests.map((req) => (
                <tr key={req.id}>
                  <td>{req.patientName}</td>
                  <td>{req.testName}</td>
                  <td>{req.status}</td>
                  <td>{new Date(req.date).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Reports */}
      <section style={styles.section}>
        <h2>📊 Reports</h2>
        {reports.length === 0 ? (
          <p>No reports available</p>
        ) : (
          <ul>
            {reports.map((r) => (
              <li key={r.id}>
                {r.date} - {r.summary} ({r.patientName})
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
