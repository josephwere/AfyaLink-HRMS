import React, { useEffect, useState } from "react";

export default function LabTechDashboard({ api, token }) {
  const [tests, setTests] = useState([]);
  const [completedTests, setCompletedTests] = useState([]);

  useEffect(() => {
    fetchLabTests();
    fetchCompletedTests();
  }, []);

  const fetchLabTests = async () => {
    try {
      const res = await fetch(`${api}/labtech/pending-tests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setTests(data);
    } catch (err) {
      console.error("Error fetching lab tests:", err);
    }
  };

  const fetchCompletedTests = async () => {
    try {
      const res = await fetch(`${api}/labtech/completed-tests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setCompletedTests(data);
    } catch (err) {
      console.error("Error fetching completed tests:", err);
    }
  };

  const handleUploadResult = async (testId) => {
    const result = prompt("Enter test result:");
    if (!result) return;

    try {
      const res = await fetch(`${api}/labtech/upload-result/${testId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ result }),
      });
      if (res.ok) {
        alert("Result uploaded successfully!");
        fetchLabTests();
        fetchCompletedTests();
      }
    } catch (err) {
      console.error("Error uploading result:", err);
    }
  };

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
                <tr key={t.id}>
                  <td>{t.patientName}</td>
                  <td>{t.testType}</td>
                  <td>{t.requestedBy}</td>
                  <td>
                    <button style={styles.uploadBtn} onClick={() => handleUploadResult(t.id)}>
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
                <tr key={t.id}>
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
  table: { width: "100%", borderCollapse: "collapse", marginTop: "10px" },
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
