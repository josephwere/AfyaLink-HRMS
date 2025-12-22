import React, { useEffect, useState } from "react";
import { apiFetch } from "../../utils/apiFetch";

export default function LabTechDashboard() {
  const [tests, setTests] = useState([]);
  const [completedTests, setCompletedTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  /* --------------------------------------------------
     LOAD DATA
  -------------------------------------------------- */
  const loadAll = async () => {
    setLoading(true);
    setErr("");

    try {
      const [pendingRes, completedRes] = await Promise.all([
        apiFetch("/api/labtech/pending-tests"),
        apiFetch("/api/labtech/completed-tests"),
      ]);

      if (!pendingRes.ok || !completedRes.ok) {
        throw new Error("Failed to load lab tests");
      }

      const [pending, completed] = await Promise.all([
        pendingRes.json(),
        completedRes.json(),
      ]);

      setTests(pending);
      setCompletedTests(completed);
    } catch (e) {
      setErr(e.message || "Failed to load lab data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  /* --------------------------------------------------
     UPLOAD LAB RESULT
  -------------------------------------------------- */
  const handleUploadResult = async (testId) => {
    const result = prompt("Enter test result:");
    if (!result) return;

    try {
      const res = await apiFetch(`/api/labtech/upload-result/${testId}`, {
        method: "POST",
        body: JSON.stringify({ result }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.msg || "Failed to upload result");
      }

      alert("✅ Result uploaded successfully!");
      loadAll();
    } catch (e) {
      alert(e.message || "Error uploading result");
    }
  };

  if (loading) return <p>Loading lab dashboard...</p>;
  if (err) return <p style={{ color: "red" }}>{err}</p>;

  return (
    <div>
      <h1>🧪 Lab Technician Dashboard</h1>

      {/* Pending Lab Tests */}
      <section style={styles.section}>
        <h2>📝 Pending Lab Tests ({tests.length})</h2>
        {tests.length === 0 ? (
          <p>No pending lab tests</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th>Patient</th>
                <th>Test Type</th>
                <th>Requested By</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {tests.map((t) => (
                <tr key={t._id || t.id}>
                  <td>{t.patientName}</td>
                  <td>{t.testType}</td>
                  <td>{t.requestedBy}</td>
                  <td>
                    <button
                      style={styles.uploadBtn}
                      onClick={() => handleUploadResult(t._id || t.id)}
                    >
                      📤 Upload Result
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Completed Lab Tests */}
      <section style={styles.section}>
        <h2>✅ Completed Lab Tests ({completedTests.length})</h2>
        {completedTests.length === 0 ? (
          <p>No completed lab tests</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th>Patient</th>
                <th>Test Type</th>
                <th>Result</th>
                <th>Completed By</th>
              </tr>
            </thead>
            <tbody>
              {completedTests.map((t) => (
                <tr key={t._id || t.id}>
                  <td>{t.patientName}</td>
                  <td>{t.testType}</td>
                  <td>{t.result}</td>
                  <td>{t.completedBy}</td>
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
  uploadBtn: {
    padding: "6px 12px",
    borderRadius: "6px",
    border: "none",
    cursor: "pointer",
    backgroundColor: "#06b6d4",
    color: "white",
    fontWeight: "bold",
  },
};
