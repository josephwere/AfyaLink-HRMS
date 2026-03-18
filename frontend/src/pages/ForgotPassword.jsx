import { useState } from "react";
import { apiFetch } from "../utils/apiFetch";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    setError("");

    try {
      await apiFetch("/healthz", {
        method: "GET",
        timeoutMs: 4000,
        _skipOfflineQueue: true,
      });

      await apiFetch("/api/auth/forgot-password", {
        method: "POST",
        body: { email },
        timeoutMs: 45000,
      });

      // ✅ Always generic (security best practice)
      setMsg("If the email exists, a reset link has been sent.");
    } catch (err) {
      const message = err.message || "Something went wrong";
      if (message.toLowerCase().includes("network error")) {
        setError("Backend is unavailable right now. Please wait 20–30 seconds and try again.");
        return;
      }
      if (message.toLowerCase().includes("timed out")) {
        setError("Server is waking up. Please wait 20–30 seconds and try again.");
        return;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-bg">
      <form className="auth-card" onSubmit={submit}>
        <h1>Forgot password</h1>
        <p className="subtitle">
          Enter your email and we’ll send you a reset link
        </p>

        {error && <div className="auth-error">{error}</div>}
        {msg && <div className="auth-info">{msg}</div>}

        <label>Email address</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />

        <button type="submit" disabled={loading}>
          {loading ? "Sending..." : "Send reset link"}
        </button>
      </form>
    </div>
  );
}
