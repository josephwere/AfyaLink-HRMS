import React from "react";

export default function Sidebar({ currentPage, setPage, onLogout, role }) {
  return (
    <aside className="sidebar">
      <h2 className="logo">AfyaLink HRMS</h2>

      <nav className="nav">
        <button
          className={`nav-btn ${currentPage === "dashboard" ? "active" : ""}`}
          onClick={() => setPage("dashboard")}
        >
          🏠 Dashboard
        </button>

        <button
          className={`nav-btn ${currentPage === "patients" ? "active" : ""}`}
          onClick={() => setPage("patients")}
        >
          🧑‍⚕️ Patients
        </button>

        <button
          className={`nav-btn ${currentPage === "appointments" ? "active" : ""}`}
          onClick={() => setPage("appointments")}
        >
          📅 Appointments
        </button>

        {/* Super Admin */}
        {role === "superadmin" && (
          <>
            <button
              className={`nav-btn ${currentPage === "superadmin" ? "active" : ""}`}
              onClick={() => setPage("superadmin")}
            >
              👑 Hospital Admins
            </button>
            <button
              className={`nav-btn ${currentPage === "hospitallist" ? "active" : ""}`}
              onClick={() => setPage("hospitallist")}
            >
              🏥 Hospitals
            </button>
            <button
              className={`nav-btn ${currentPage === "notifications" ? "active" : ""}`}
              onClick={() => setPage("notifications")}
            >
              🔔 Notifications
            </button>
            <button
              className={`nav-btn ${currentPage === "profile" ? "active" : ""}`}
              onClick={() => setPage("profile")}
            >
              👤 Profile
            </button>
          </>
        )}

        {/* Hospital Admin */}
        {role === "hospitaladmin" && (
          <>
            <button
              className={`nav-btn ${currentPage === "hospitalstaff" ? "active" : ""}`}
              onClick={() => setPage("hospitalstaff")}
            >
              🏥 Staff
            </button>
            <button
              className={`nav-btn ${currentPage === "hospitalappointments" ? "active" : ""}`}
              onClick={() => setPage("hospitalappointments")}
            >
              📅 Appointments
            </button>
            <button
              className={`nav-btn ${currentPage === "reports" ? "active" : ""}`}
              onClick={() => setPage("reports")}
            >
              📊 Reports
            </button>
            <button
              className={`nav-btn ${currentPage === "profile" ? "active" : ""}`}
              onClick={() => setPage("profile")}
            >
              👤 Profile
            </button>
            <button
              className={`nav-btn ${currentPage === "notifications" ? "active" : ""}`}
              onClick={() => setPage("notifications")}
            >
              🔔 Notifications
            </button>
          </>
        )}

        {/* Doctor */}
        {role === "doctor" && (
          <>
            <button
              className={`nav-btn ${currentPage === "doctordashboard" ? "active" : ""}`}
              onClick={() => setPage("doctordashboard")}
            >
              🩺 Dashboard
            </button>
            <button
              className={`nav-btn ${currentPage === "assignedpatients" ? "active" : ""}`}
              onClick={() => setPage("assignedpatients")}
            >
              🧾 Assigned Patients
            </button>
            <button
              className={`nav-btn ${currentPage === "myappointments" ? "active" : ""}`}
              onClick={() => setPage("myappointments")}
            >
              📅 Appointments
            </button>
            <button
              className={`nav-btn ${currentPage === "labrequests" ? "active" : ""}`}
              onClick={() => setPage("labrequests")}
            >
              🧪 Lab Requests
            </button>
            <button
              className={`nav-btn ${currentPage === "reports" ? "active" : ""}`}
              onClick={() => setPage("reports")}
            >
              📊 Reports
            </button>
            <button
              className={`nav-btn ${currentPage === "profile" ? "active" : ""}`}
              onClick={() => setPage("profile")}
            >
              👤 Profile
            </button>
            <button
              className={`nav-btn ${currentPage === "notifications" ? "active" : ""}`}
              onClick={() => setPage("notifications")}
            >
              🔔 Notifications
            </button>
          </>
        )}

        {/* Nurse */}
        {role === "nurse" && (
          <>
            <button
              className={`nav-btn ${currentPage === "nursedashboard" ? "active" : ""}`}
              onClick={() => setPage("nursedashboard")}
            >
              🩺 Dashboard
            </button>
            <button
              className={`nav-btn ${currentPage === "nursepatients" ? "active" : ""}`}
              onClick={() => setPage("nursepatients")}
            >
              🧾 Assigned Patients
            </button>
            <button
              className={`nav-btn ${currentPage === "nurseappointments" ? "active" : ""}`}
              onClick={() => setPage("nurseappointments")}
            >
              📅 Appointments Support
            </button>
            <button
              className={`nav-btn ${currentPage === "medicalrecords" ? "active" : ""}`}
              onClick={() => setPage("medicalrecords")}
            >
              📝 Medical Records
            </button>
            <button
              className={`nav-btn ${currentPage === "profile" ? "active" : ""}`}
              onClick={() => setPage("profile")}
            >
              👤 Profile
            </button>
            <button
              className={`nav-btn ${currentPage === "notifications" ? "active" : ""}`}
              onClick={() => setPage("notifications")}
            >
              🔔 Notifications
            </button>
          </>
        )}

        {/* Lab Technician */}
        {role === "labtech" && (
          <>
            <button
              className={`nav-btn ${currentPage === "labtechdashboard" ? "active" : ""}`}
              onClick={() => setPage("labtechdashboard")}
            >
              🧪 Dashboard
            </button>
            <button
              className={`nav-btn ${currentPage === "labtests" ? "active" : ""}`}
              onClick={() => setPage("labtests")}
            >
              📝 Lab Tests
            </button>
            <button
              className={`nav-btn ${currentPage === "uploadresults" ? "active" : ""}`}
              onClick={() => setPage("uploadresults")}
            >
              📤 Upload Results
            </button>
            <button
              className={`nav-btn ${currentPage === "profile" ? "active" : ""}`}
              onClick={() => setPage("profile")}
            >
              👤 Profile
            </button>
            <button
              className={`nav-btn ${currentPage === "notifications" ? "active" : ""}`}
              onClick={() => setPage("notifications")}
            >
              🔔 Notifications
            </button>
          </>
        )}

        {/* Patient */}
        {role === "patient" && (
          <>
            <button
              className={`nav-btn ${currentPage === "patientdashboard" ? "active" : ""}`}
              onClick={() => setPage("patientdashboard")}
            >
              🏥 Dashboard
            </button>
            <button
              className={`nav-btn ${currentPage === "patientappointments" ? "active" : ""}`}
              onClick={() => setPage("patientappointments")}
            >
              📅 Appointments
            </button>
            <button
              className={`nav-btn ${currentPage === "patientrecords" ? "active" : ""}`}
              onClick={() => setPage("patientrecords")}
            >
              🧾 Medical Records
            </button>
            <button
              className={`nav-btn ${currentPage === "patientlabresults" ? "active" : ""}`}
              onClick={() => setPage("patientlabresults")}
            >
              🧪 Lab Results
            </button>
            <button
              className={`nav-btn ${currentPage === "profile" ? "active" : ""}`}
              onClick={() => setPage("profile")}
            >
              👤 Profile
            </button>
            <button
              className={`nav-btn ${currentPage === "notifications" ? "active" : ""}`}
              onClick={() => setPage("notifications")}
            >
              🔔 Notifications
            </button>
          </>
        )}
      </nav>

      <button className="logout-btn" onClick={onLogout}>
        🔒 Logout
      </button>

      <style>{`
        .sidebar {
          width: 220px;
          background: linear-gradient(180deg, #4f46e5, #06b6d4);
          color: white;
          display: flex;
          flex-direction: column;
          padding: 20px 10px;
          border-radius: 12px;
          height: 100vh;
          box-shadow: 0 8px 24px rgba(0,0,0,0.15);
        }

        .logo {
          font-size: 24px;
          text-align: center;
          margin-bottom: 30px;
          font-weight: bold;
        }

        .nav {
          display: flex;
          flex-direction: column;
          gap: 12px;
          flex-grow: 1;
        }

        .nav-btn {
          background: rgba(255,255,255,0.15);
          border: none;
          border-radius: 8px;
          padding: 12px 15px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 600;
          color: white;
          transition: all 0.3s;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .nav-btn:hover {
          background: rgba(255,255,255,0.3);
          transform: translateX(4px);
        }

        .nav-btn.active {
          background: rgba(255,255,255,0.5);
          transform: translateX(2px);
        }

        .logout-btn {
          margin-top: auto;
          background: #ef4444;
          border: none;
          border-radius: 8px;
          padding: 12px;
          font-weight: bold;
          cursor: pointer;
          transition: 0.3s;
        }

        .logout-btn:hover {
          background: #dc2626;
          transform: translateY(-2px);
        }
      `}</style>
    </aside>
  );
    }
