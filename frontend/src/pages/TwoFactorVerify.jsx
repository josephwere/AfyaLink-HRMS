import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../utils/apiFetch";
import { useAuth } from "../utils/auth";

export default function TwoFactorVerify() {
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { complete2FA } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 🔐 Verify OTP
      const userId = localStorage.getItem("2fa_user");
      if (!userId) throw new Error("Missing 2FA user");

      const data = await apiFetch("/api/auth/2fa/verify", {
        method: "POST",
        body: { userId, otp },
      });

      // ✅ Store full access token
      complete2FA(data.accessToken, data.refreshToken);

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
