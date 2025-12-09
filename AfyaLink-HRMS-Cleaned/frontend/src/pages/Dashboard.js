import React, { useEffect, useState } from "react";

export default function DoctorDashboard({ api, token }) {
  const [stats, setStats] = useState({ patients: 0, appointments: 0, labRequests: 0 });
  const [recentPatients, setRecentPatients] = useState([]);

  useEffect(() => {
    fetchStats();
    fetchRecentPatients();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch(`${api}/doctor/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRecentPatients = async () => {
    try {
      const res = await fetch(`${api}/doctor/recent-patients`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setRecentPatients(data);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <h1>👨‍⚕️ Doctor Dashboard</h1>

      {/* Stats cards */}
      <div style={styles.statsContainer}>
        <div style={{ ...styles.card, background: "#4f46e5" }}>
          🧑‍⚕️ Patients <span>{stats.patients}</span>
        </div>
        <div style={{ ...styles.card, background: "#06b6d4" }}>
          📅 Appointments <span>{stats.appointments}</span>
        </div>
        <div style={{ ...styles.card, background: "#f59e0b" }}>
          🧪 Lab Requests <span>{stats.labRequests}</span>
        </div>
      </div>

      {/* Recent Patients */}
      <h2>🧾 Recent Patients</h2>
      <table style={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Age</th>
            <th>Last Visit</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {recentPatients.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>{p.age}</td>
              <td>{new Date(p.lastVisit).toLocaleDateString()}</td>
              <td>{p.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  statsContainer: {
    display: "flex",
    gap: "20px",
    marginBottom: "30px",
  },
  card: {
    flex: 1,
    padding: "20px",
    borderRadius: "12px",
    color: "white",
    fontWeight: "bold",
    fontSize: "18px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: { textAlign: "left", borderBottom: "2px solid #ddd", padding: "8px" },
  td: { padding: "8px", borderBottom: "1px solid #eee" },
};
