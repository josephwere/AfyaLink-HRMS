import React, { useEffect, useState } from "react";
import { apiFetch } from "../../utils/apiFetch";

export default function DoctorDashboard() {
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [labRequests, setLabRequests] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);

      const [
        patientsRes,
        appointmentsRes,
        labRequestsRes,
        reportsRes,
      ] = await Promise.all([
        apiFetch("/api/doctor/patients"),
        apiFetch("/api/doctor/appointments"),
        apiFetch("/api/doctor/lab-requests"),
        apiFetch("/api/doctor/reports"),
      ]);

      if (
        !patientsRes.ok ||
        !appointmentsRes.ok ||
        !labRequestsRes.ok ||
        !reportsRes.ok
      ) {
        throw new Error("Failed to load doctor dashboard");
      }

      const patientsData = await patientsRes.json();
      const appointmentsData = await appointmentsRes.json();
      const labRequestsData = await labRequestsRes.json();
      const reportsData = await reportsRes.json();

      setPatients(patientsData);
      setAppointments(appointmentsData);
      setLabRequests(labRequestsData);
      setReports(reportsData);
    } catch (err) {
      console.error("Doctor dashboard error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading doctor dashboard...</div>;
  }

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
                {new Date(r.date).toLocaleDateString()} — {r.summary} (
                {r.patientName})
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const styles = {
  section: {
    marginBottom: "30px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    marginTop: "10px",
  },
};
