import React, { useEffect, useState } from "react";
import { apiFetch } from "../../utils/apiFetch";

export default function DoctorDashboard() {
  const [stats, setStats] = useState({
    patients: 0,
    appointments: 0,
    labRequests: 0,
  });

  const [recentPatients, setRecentPatients] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      await Promise.all([fetchStats(), fetchRecentPatients()]);
    } catch (err) {
      setError("Failed to load dashboard data");
      console.error(err);
    }
  };

  const fetchStats = async () => {
    const res = await apiFetch("/api/doctor/stats");

    if (!res.ok) {
      throw new Error("Failed to fetch stats");
    }

    const data = await res.json();
    setStats(data);
  };

  const fetchRecentPatients = async () => {
    const res = await apiFetch("/api/doctor/recent-patients");

    if (!res.ok) {
      throw new Error("Failed to fetch patients");
    }

    const data = await res.json();
    setRecentPatients(data);
  };

  return (
    <div>
      <h1>👨‍⚕️ Doctor Dashboard</h1>

      {error && <div className="auth-error">{error}</div>}

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
            <th style={styles.th}>Name</th>
            <th style={styles.th}>Age</th>
            <th style={styles.th}>Last Visit</th>
            <th style={styles.th}>Status</th>
          </tr>
        </thead>
        <tbody>
          {recentPatients.map((p) => (
            <tr key={p._id || p.id}>
              <td style={styles.td}>{p.name}</td>
              <td style={styles.td}>{p.age}</td>
              <td style={styles.td}>
                {new Date(p.lastVisit).toLocaleDateString()}
              </td>
              <td style={styles.td}>{p.status}</td>
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
  th: {
    textAlign: "left",
    borderBottom: "2px solid #ddd",
    padding: "8px",
  },
  td: {
    padding: "8px",
    borderBottom: "1px solid #eee",
  },
};
