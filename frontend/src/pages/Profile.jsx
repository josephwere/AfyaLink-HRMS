import { useEffect, useState } from "react";
import { apiFetch } from "../utils/apiFetch";

export default function Profile() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 🔐 Email verification state
  const [emailVerified, setEmailVerified] = useState(true);
  const [verificationWarning, setVerificationWarning] = useState(null);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      // 2FA status
      const res = await apiFetch("/api/2fa/status");
      if (!res.ok) throw new Error("Failed to load 2FA status");
      const data = await res.json();
      setEnabled(Boolean(data.enabled));

      // 🔐 verification status (from /me or similar endpoint)
      const meRes = await apiFetch("/api/users/me");
      if (meRes.ok) {
        const me = await meRes.json();
        setEmailVerified(me.emailVerified);
        setVerificationWarning(me.verificationWarning || null);
      }
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

  const resendVerification = async () => {
    try {
      setSending(true);
      setMessage("");
      const res = await apiFetch("/api/auth/resend-verification", {
        method: "POST",
      });

      if (!res.ok) throw new Error("Failed");
      setMessage("📩 Verification email sent. Check your inbox.");
    } catch {
      setMessage("❌ Failed to send verification email");
    } finally {
      setSending(false);
    }
  };

  const renderVerificationWarning = () => {
    if (emailVerified || !verificationWarning) return null;

    const map = {
      "14d": "Your profile will be deleted in 14 days.",
      "3d": "Your profile will be deleted in 3 days.",
      "2h": "Your profile will be deleted in 2 hours.",
      EXPIRED: "Your account has expired and will be deleted.",
    };

    return (
      <div className="warning-card">
        <strong>⚠️ Kindly verify your account</strong>
        <p>{map[verificationWarning.type]}</p>

        {verificationWarning.type !== "EXPIRED" && (
          <button
            className="primary"
            disabled={sending}
            onClick={resendVerification}
          >
            {sending ? "Sending..." : "Verify Account"}
          </button>
        )}

        {message && <p style={{ marginTop: 8 }}>{message}</p>}
      </div>
    );
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div className="premium-card">
      <h2>🔐 Security Settings</h2>

      {renderVerificationWarning()}

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
