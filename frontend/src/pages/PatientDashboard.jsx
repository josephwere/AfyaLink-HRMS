import React, { useEffect, useState } from "react";
import { apiFetch } from "../../utils/apiFetch";

export default function PatientDashboard() {
  const [appointments, setAppointments] = useState([]);
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [labResults, setLabResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  /* --------------------------------------------------
     LOAD ALL DATA
  -------------------------------------------------- */
  const loadAll = async () => {
    setLoading(true);
    setErr("");

    try {
      const [apptRes, recordsRes, labsRes] = await Promise.all([
        apiFetch("/api/patients/appointments"),
        apiFetch("/api/patients/records"),
        apiFetch("/api/patients/lab-results"),
      ]);

      if (!apptRes.ok || !recordsRes.ok || !labsRes.ok) {
        throw new Error("Failed to load patient data");
      }

      const [appts, records, labs] = await Promise.all([
        apptRes.json(),
        recordsRes.json(),
        labsRes.json(),
      ]);

      setAppointments(appts);
      setMedicalRecords(records);
      setLabResults(labs);
    } catch (e) {
      setErr(e.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  if (loading) return <p>Loading patient dashboard...</p>;
  if (err) return <p style={{ color: "red" }}>{err}</p>;

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
                <tr key={a._id || a.id}>
                  <td>{new Date(a.date).toLocaleDateString()}</td>
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
                <tr key={r._id || r.id}>
                  <td>{new Date(r.date).toLocaleDateString()}</td>
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
                <tr key={l._id || l.id}>
                  <td>{new Date(l.date).toLocaleDateString()}</td>
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
  table: {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: "10px",
  },
};
