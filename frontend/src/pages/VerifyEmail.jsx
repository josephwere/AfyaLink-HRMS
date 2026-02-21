import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { apiFetch } from "../utils/apiFetch";
import "./verify.css";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState("verifying");
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");

  const token = params.get("token");

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }

    apiFetch(`/api/auth/verify-email?token=${token}`)
      .then(() => setStatus("success"))
      .catch(() => setStatus("error"));
  }, [token]);

  // ⏱️ Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handleResend = async () => {
    try {
      setLoading(true);
      const data = await apiFetch("/api/auth/resend-verification", {
        method: "POST",
        body: { email },
      });

      setCooldown(data.retryAfter || 60);
    } catch {
      alert("Failed to resend verification email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="verify-page">
      {status === "verifying" && (
        <div className="card pulse">
          <h1>Verifying…</h1>
          <p>Please wait</p>
        </div>
      )}

      {status === "success" && (
        <div className="card success pop">
          <h1>✅ Email Verified</h1>
          <p>Your account is now active.</p>
          <Link to="/login" className="btn">
            Go to Login
          </Link>
        </div>
      )}

      {status === "invalid" && (
        <div className="card error shake">
          <h1>❌ Invalid Link</h1>
          <p>This verification link is invalid.</p>
        </div>
      )}

      {status === "error" && (
        <div className="card error shake">
          <h1>❌ Verification Failed</h1>
          <p>Link expired or already used.</p>

          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ marginTop: 12 }}
          />

          <button
            onClick={handleResend}
            disabled={loading || cooldown > 0 || !email}
            className="btn secondary"
          >
            {cooldown > 0
              ? `Resend in ${cooldown}s`
              : loading
              ? "Sending…"
              : "Resend verification email"}
          </button>
        </div>
      )}
    </div>
  );
}
