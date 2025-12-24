import { useState } from "react";
import { apiFetch } from "../utils/apiFetch";

export default function AdminVerifyUser() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");

  const handleVerify = async () => {
    try {
      const res = await apiFetch("/api/admin/verify-user", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.msg);
      setMsg("✅ User verified successfully");
    } catch (err) {
      setMsg(err.message);
    }
  };

  return (
    <div className="card">
      <h2>Admin Email Verification</h2>
      <input
        placeholder="User email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button onClick={handleVerify}>Verify User</button>
      {msg && <p>{msg}</p>}
    </div>
  );
                                  }
