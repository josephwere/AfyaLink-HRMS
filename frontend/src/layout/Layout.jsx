import Sidebar from "./Sidebar";
import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "../utils/auth";

export default function Layout() {
  const { user } = useAuth();
  const isGuest = user?.role === "guest";

  // 🔐 UX-level 2FA enforcement
  if (user && user.twoFactorVerified === false) {
    return <Navigate to="/2fa" replace />;
  }

  return (
    <div style={{ display: "flex", position: "relative" }}>
      <Sidebar />

      {/* 🌊 GLOBAL DEMO WATERMARK */}
      {isGuest && (
        <div
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%) rotate(-30deg)",
            fontSize: "120px",
            fontWeight: 800,
            color: "rgba(0,0,0,0.05)",
            pointerEvents: "none",
            zIndex: 9999,
            userSelect: "none",
            whiteSpace: "nowrap",
          }}
        >
          DEMO
        </div>
      )}

      <div className="main">
        <Outlet />
      </div>
    </div>
  );
}
