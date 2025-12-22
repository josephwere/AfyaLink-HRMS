import { useEffect, useState } from "react";
import { apiFetch } from "../utils/apiFetch";

export default function Profile() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const res = await apiFetch("/api/2fa/status");
      if (!res.ok) throw new Error("Failed to load 2FA status");
      const data = await res.json();
      setEnabled(Boolean(data.enabled));
    } catch (err) {
      setError("Unable to load security settings");
    } finally {
      setLoading(false);
    }
  };

  const toggle2FA = async () => {
    try {
      const next = !enabled;
      const res = await apiFetch("/api/2fa/toggle", {
        method: "POST",
        body: JSON.stringify({ enabled: next }),
      });

      if (!res.ok) throw new Error("Failed to update");
      setEnabled(next);
    } catch {
      setError("Failed to update 2FA setting");
    }
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div className="premium-card">
      <h2>🔐 Security Settings</h2>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <div className="row">
        <span>Email OTP (2FA)</span>
        <button
          className={enabled ? "danger" : "success"}
          onClick={toggle2FA}
        >
          {enabled ? "Disable" : "Enable"}
        </button>
      </div>

      <p style={{ opacity: 0.7, marginTop: 8 }}>
        {enabled
          ? "2FA is enabled. You’ll be asked for a code at login."
          : "2FA is disabled. Your account uses password only."}
      </p>
    </div>
  );
}
