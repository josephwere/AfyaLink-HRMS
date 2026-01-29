import { useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth";
import apiFetch from "../utils/apiFetch";

const COOLDOWN_KEY = "verifyCooldownUntil";

export default function Profile() {
  const { user, fetchUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 2FA
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);

  // Email verification
  const [emailVerified, setEmailVerified] = useState(true);
  const [verificationWarning, setVerificationWarning] = useState(null);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    restoreCooldown();
    loadStatus();
  }, []);

  /* -------------------------
     Restore resend cooldown
  -------------------------- */
  const restoreCooldown = () => {
    const until = Number(localStorage.getItem(COOLDOWN_KEY));
    if (!until) return;

    const remaining = Math.ceil((until - Date.now()) / 1000);
    if (remaining > 0) setCooldown(remaining);
    else localStorage.removeItem(COOLDOWN_KEY);
  };

  /* -------------------------
     Cooldown timer
  -------------------------- */
  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          localStorage.removeItem(COOLDOWN_KEY);
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldown]);

  /* -------------------------
     Load 2FA + email status
  -------------------------- */
  const loadStatus = async () => {
    try {
      // 2FA status
      const res2FA = await apiFetch("/api/2fa/status");
      if (!res2FA.ok) throw new Error("Failed to load 2FA status");
      const data2FA = await res2FA.json();
      setTwoFAEnabled(Boolean(data2FA.enabled));

      // Email verification status
      const meRes = await apiFetch("/api/users/me");
      if (!meRes.ok) throw new Error("Failed to fetch user info");
      const me = await meRes.json();

      setEmailVerified(me.emailVerified);
      setVerificationWarning(me.verificationWarning || null);
    } catch (err) {
      setError("Unable to load security settings");
    } finally {
      setLoading(false);
    }
  };

  /* -------------------------
     Toggle 2FA
  -------------------------- */
  const toggle2FA = async () => {
    try {
      const next = !twoFAEnabled;
      const res = await apiFetch("/api/2fa/toggle", {
        method: "POST",
        body: { enabled: next },
      });

      if (!res.ok) throw new Error("Failed to update 2FA");
      setTwoFAEnabled(next);
    } catch {
      setError("Failed to update 2FA setting");
    }
  };

  /* -------------------------
     Resend email verification
  -------------------------- */
  const resendVerification = async () => {
    try {
      setSending(true);
      setMessage("");
      const res = await apiFetch("/api/auth/resend-verification", {
        method: "POST",
        body: { email: user?.email },
      });

      if (!res.ok) throw new Error("Failed");

      const data = await res.json?.() || {};
      const seconds = data.retryAfter || 60;
      localStorage.setItem(COOLDOWN_KEY, Date.now() + seconds * 1000);
      setCooldown(seconds);

      setMessage("📩 Verification email sent. Check your inbox.");
    } catch {
      setMessage("❌ Failed to send verification email");
    } finally {
      setSending(false);
    }
  };

  /* -------------------------
     Render email verification warning
  -------------------------- */
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
            disabled={sending || cooldown > 0}
            onClick={resendVerification}
          >
            {sending
              ? "Sending..."
              : cooldown > 0
              ? `Resend in ${cooldown}s`
              : "Verify Account"}
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
          className={twoFAEnabled ? "danger" : "success"}
          onClick={toggle2FA}
        >
          {twoFAEnabled ? "Disable" : "Enable"}
        </button>
      </div>

      <p style={{ opacity: 0.7, marginTop: 8 }}>
        {twoFAEnabled
          ? "2FA is enabled. You’ll be asked for a code at login."
          : "2FA is disabled. Your account uses password only."}
      </p>
    </div>
  );
}
