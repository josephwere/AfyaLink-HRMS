import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../utils/apiFetch";
import { useAuth } from "../utils/auth";

export default function TwoFactorVerify() {
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 🔐 Verify OTP
      const res = await apiFetch("/api/auth/verify-2fa", {
        method: "POST",
        body: JSON.stringify({ otp }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.msg || "Invalid OTP");
      }

      // ✅ Store full access token
      login(null, data.accessToken);

      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-bg">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Two-Factor Authentication</h1>
        <p className="subtitle">
          Enter the 6-digit code sent to your email
        </p>

        {error && <div className="auth-error">{error}</div>}

        <input
          type="text"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          placeholder="123456"
          maxLength={6}
          required
        />

        <button disabled={loading}>
          {loading ? "Verifying..." : "Verify"}
        </button>
      </form>
    </div>
  );
}
