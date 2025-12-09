import React, { useEffect, useState } from "react";

export default function PatientDashboard({ api, token }) {
  const [appointments, setAppointments] = useState([]);
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [labResults, setLabResults] = useState([]);

  useEffect(() => {
    fetchAppointments();
    fetchMedicalRecords();
    fetchLabResults();
  }, []);

  const fetchAppointments = async () => {
    try {
      const res = await fetch(`${api}/patients/appointments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setAppointments(data);
    } catch (err) {
      console.error("Error fetching appointments:", err);
    }
  };

  const fetchMedicalRecords = async () => {
    try {
      const res = await fetch(`${api}/patients/records`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setMedicalRecords(data);
    } catch (err) {
      console.error("Error fetching medical records:", err);
    }
  };

  const fetchLabResults = async () => {
    try {
      const res = await fetch(`${api}/patients/lab-results`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setLabResults(data);
    } catch (err) {
      console.error("Error fetching lab results:", err);
    }
  };

  return (
    <div>
      <h1>🏥 Patient Dashboard</h1>

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
                <th>Time</th>
                <th>Doctor</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((a) => (
                <tr key={a.id}>
                  <td>{a.date}</td>
                  <td>{a.time}</td>
                  <td>{a.doctorName}</td>
                  <td>{a.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Medical Records */}
      <section style={styles.section}>
        <h2>🧾 Medical Records ({medicalRecords.length})</h2>
        {medicalRecords.length === 0 ? (
          <p>No medical records available</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Doctor</th>
                <th>Diagnosis</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {medicalRecords.map((r) => (
                <tr key={r.id}>
                  <td>{r.date}</td>
                  <td>{r.doctorName}</td>
                  <td>{r.diagnosis}</td>
                  <td>{r.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Lab Results */}
      <section style={styles.section}>
        <h2>🧪 Lab Results ({labResults.length})</h2>
        {labResults.length === 0 ? (
          <p>No lab results available</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Test Type</th>
                <th>Result</th>
                <th>Doctor</th>
              </tr>
            </thead>
            <tbody>
              {labResults.map((l) => (
                <tr key={l.id}>
                  <td>{l.date}</td>
                  <td>{l.testType}</td>
                  <td>{l.result}</td>
                  <td>{l.doctorName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

const styles = {
  section: { marginBottom: "30px" },
  table: { width: "100%", borderCollapse: "collapse", marginTop: "10px" },
};
