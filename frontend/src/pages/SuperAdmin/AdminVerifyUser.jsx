import { useState } from "react";
import { apiFetch } from "../../utils/apiFetch";

export default function AdminVerifyUser() {
  const [userId, setUserId] = useState("");
  const [msg, setMsg] = useState("");

  const handleVerify = async () => {
    try {
      await apiFetch(`/api/auth/admin/verify-user/${userId}`, {
        method: "POST",
      });
      setMsg("✅ User verified successfully");
    } catch (err) {
      setMsg(err.message);
    }
  };

  return (
    <div className="dashboard premium-shell">
      <section className="premium-card premium-shell-head">
        <div className="premium-shell-kicker">Identity override</div>
        <div>
          <h1 className="premium-shell-title">Admin User Verification</h1>
          <p className="premium-shell-subtitle">
            Manually verify a user record when support or compliance needs to unblock a legitimate account.
          </p>
        </div>
      </section>

      <section className="card premium-card form premium-stack">
        <label>User ID</label>
        <input
          placeholder="User ID"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        />
        <div className="welcome-actions">
          <button type="button" className="btn-primary" onClick={handleVerify}>Verify User</button>
        </div>
        {msg ? <div className="premium-inline-note">{msg}</div> : null}
      </section>
    </div>
  );
}
