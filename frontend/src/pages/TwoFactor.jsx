import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiFetch } from "../utils/apiFetch";
import { useAuth } from "../utils/auth";

export default function TwoFactor() {
  const navigate = useNavigate();
  const location = useLocation();
  const { complete2FA } = useAuth();

  const userId = location.state?.userId;

  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  /* ---------------------------------------
     Guard: no userId → back to login
  ---------------------------------------- */
  useEffect(() => {
    if (!userId) {
      navigate("/login", { replace: true });
    }
  }, [userId, navigate]);

  if (!userId) return null;

  /* ---------------------------------------
     Submit OTP
  ---------------------------------------- */
  const submitOtp = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await apiFetch("/api/auth/verify-2fa", {
        method: "POST",
        body: JSON.stringify({ userId, otp }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.msg || "Invalid or expired code");
      }

      // 🔓 Unlock session (store access token + mark verified)
      complete2FA(data.accessToken);

      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <h2>🔐 Two-Factor Authentication</h2>
      <p>Enter the 6-digit code sent to your email</p>

      {error && <p className="error">{error}</p>}

      <form onSubmit={submitOtp}>
        <input
          type="text"
          inputMode="numeric"
          maxLength="6"
          placeholder="123456"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
          required
        />

        <button disabled={loading || otp.length !== 6}>
          {loading ? "Verifying..." : "Verify"}
        </button>
      </form>

      <style>{`
        .auth-card {
          max-width: 420px;
          margin: 80px auto;
          padding: 32px;
          border-radius: 16px;
          background: white;
          text-align: center;
          box-shadow: 0 10px 25px rgba(0,0,0,0.08);
        }
        input {
          width: 100%;
          padding: 14px;
          margin: 20px 0;
          font-size: 20px;
          text-align: center;
          letter-spacing: 8px;
          border-radius: 10px;
          border: 1px solid #ddd;
        }
        button {
          width: 100%;
          padding: 14px;
          background: #2563eb;
          color: white;
          border: none;
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
        }
        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .error {
          color: #dc2626;
          margin-top: 12px;
        }
      `}</style>
    </div>
  );
}
