import React, { useState } from "react";

export default function Navbar({ currentPage, setPage, onLogout, notifications }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <h1 className="navbar-logo">AfyaLink HRMS</h1>
      </div>

      <div className={`navbar-center ${menuOpen ? "open" : ""}`}>
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
      </div>

      <div className="navbar-right">
        <div className="notifications">
          🔔
          {notifications && notifications.length > 0 && (
            <span className="badge">{notifications.length}</span>
          )}
        </div>

        <button className="logout-btn" onClick={onLogout}>
          🔒 Logout
        </button>

        <button
          className="menu-toggle"
          onClick={() => setMenuOpen((prev) => !prev)}
        >
          ☰
        </button>
      </div>

      <style>{`
        .navbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 24px;
          background: linear-gradient(90deg, #4f46e5, #06b6d4);
          color: white;
          border-radius: 12px;
          margin-bottom: 20px;
          box-shadow: 0 6px 16px rgba(0,0,0,0.1);
        }

        .navbar-logo {
          font-size: 24px;
          font-weight: 700;
          background: linear-gradient(90deg, #fff, #e0e0ff);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .navbar-center {
          display: flex;
          gap: 12px;
        }

        .nav-btn {
          background: rgba(255,255,255,0.15);
          border: none;
          border-radius: 8px;
          padding: 8px 16px;
          cursor: pointer;
          font-weight: 600;
          color: white;
          transition: 0.3s;
        }

        .nav-btn.active {
          background: rgba(255,255,255,0.5);
        }

        .nav-btn:hover {
          background: rgba(255,255,255,0.3);
          transform: translateY(-2px);
        }

        .navbar-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .notifications {
          position: relative;
          font-size: 20px;
          cursor: pointer;
        }

        .badge {
          position: absolute;
          top: -6px;
          right: -6px;
          background: #ef4444;
          color: white;
          font-size: 12px;
          font-weight: bold;
          padding: 2px 6px;
          border-radius: 50%;
        }

        .logout-btn {
          background: #ef4444;
          border: none;
          border-radius: 8px;
          padding: 8px 16px;
          color: white;
          cursor: pointer;
          font-weight: 600;
          transition: 0.3s;
        }

        .logout-btn:hover {
          background: #dc2626;
          transform: translateY(-2px);
        }

        .menu-toggle {
          display: none;
          background: rgba(255,255,255,0.2);
          border: none;
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 20px;
          cursor: pointer;
          color: white;
        }

        @media(max-width:768px) {
          .navbar-center {
            display: ${menuOpen ? "flex" : "none"};
            flex-direction: column;
            position: absolute;
            top: 60px;
            left: 0;
            width: 100%;
            background: linear-gradient(90deg, #4f46e5, #06b6d4);
            padding: 12px 0;
            border-radius: 0 0 12px 12px;
          }

          .menu-toggle {
            display: block;
          }
        }
      `}</style>
    </nav>
  );
            }
