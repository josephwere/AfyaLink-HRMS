import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../utils/auth";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const isGuest = user?.role === "guest";

  return (
    <header className="navbar">
      <div
        className="brand"
        style={{ cursor: "pointer" }}
        onClick={() => navigate(isGuest ? "/guest" : "/")}
      >
        AfyaLink HRMS 2.0
      </div>

      <div className="nav-actions">
        {isGuest ? (
          <>
            <span style={{ opacity: 0.8 }}>Demo Mode</span>
            <button
              style={ctaStyle}
              onClick={() => navigate("/register")}
            >
              Upgrade
            </button>
          </>
        ) : (
          <>
            <span>Premium • Secure • AI-assisted</span>
            <button
              style={logoutStyle}
              onClick={logout}
            >
              Logout
            </button>
          </>
        )}
      </div>
    </header>
  );
}

/* ================= STYLES ================= */

const ctaStyle = {
  marginLeft: 12,
  padding: "6px 12px",
  borderRadius: 6,
  background: "#111",
  color: "#fff",
  border: "none",
  cursor: "pointer",
};

const logoutStyle = {
  marginLeft: 12,
  padding: "6px 12px",
  borderRadius: 6,
  background: "transparent",
  border: "1px solid #999",
  cursor: "pointer",
};
