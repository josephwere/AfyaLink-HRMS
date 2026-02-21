import { useState } from "react";
import { apiFetch } from "../utils/apiFetch";

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
    <div className="card">
      <h2>Admin User Verification</h2>
      <input
        placeholder="User ID"
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
      />
      <button onClick={handleVerify}>Verify User</button>
      {msg && <p>{msg}</p>}
    </div>
  );
