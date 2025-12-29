import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "../../utils/axios"; // adjust if your axios path differs

export default function Page() {
  const [unverifiedCount, setUnverifiedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const res = await axios.get("/admin/dashboard");
        setUnverifiedCount(res.data?.stats?.unverifiedUsers || 0);
      } catch (err) {
        console.error("Admin stats failed:", err);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Admin Dashboard</h1>

      {/* 🔴 UNVERIFIED USERS WARNING */}
      {!loading && unverifiedCount > 0 && (
        <div
          style={{
            marginTop: 20,
            padding: 16,
            borderRadius: 10,
            background: "#fee2e2",
            border: "1px solid #dc2626",
            color: "#7f1d1d",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <strong>⚠️ {unverifiedCount} unverified users</strong>
            <div style={{ fontSize: 14, marginTop: 4 }}>
              Accounts pending deletion after grace period
            </div>
          </div>

          <Link
            to="/admin/users?filter=unverified"
            style={{
              background: "#dc2626",
              color: "#fff",
              padding: "8px 14px",
              borderRadius: 8,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Review Users
          </Link>
        </div>
      )}

      {/* NORMAL DASHBOARD CONTENT */}
      <div style={{ marginTop: 32, opacity: 0.7 }}>
        {/* existing widgets / charts go here */}
      </div>
    </div>
  );
    }
