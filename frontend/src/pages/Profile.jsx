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

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMessage, setPwMessage] = useState("");
  const [pwError, setPwError] = useState("");

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
      const res2FA = await apiFetch("/api/2fa/status");
      if (!res2FA.ok) throw new Error("Failed to load 2FA status");
      const data2FA = await res2FA.json();
      setTwoFAEnabled(Boolean(data2FA.enabled));

      const meRes = await apiFetch("/api/users/me");
      if (!meRes.ok) throw new Error("Failed to fetch user info");
      const me = await meRes.json();
      setEmailVerified(me.emailVerified);
      setVerificationWarning(me.verificationWarning || null);
    } catch {
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
     Render verification warning
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
      <div className="card warning-card">
        <h3>⚠️ Email Verification Required</h3>
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

  /* -------------------------
     Change password
  -------------------------- */
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwMessage("");
    setPwError("");

    if (newPassword !== confirmPassword) {
      setPwError("Passwords do not match");
      return;
    }

    setPwLoading(true);

    try {
      const res = await apiFetch("/api/auth/change-password", {
        method: "POST",
        body: { oldPassword: currentPassword, newPassword },
      });

      const data = await res.json?.() || {};
      if (!res.ok) throw new Error(data.msg || "Failed to change password");

      setPwMessage("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPwError(err.message || "Password change failed");
    } finally {
      setPwLoading(false);
    }
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div className="profile-container">
      {/* ============================
         EMAIL VERIFICATION
      ============================ */}
      {renderVerificationWarning()}

      {/* ============================
         2FA SECTION
      ============================ */}
      <div className="card">
        <h3>Two-Factor Authentication (2FA)</h3>
        <p>
          {twoFAEnabled
            ? "2FA is enabled. You’ll be asked for a code at login."
            : "2FA is disabled. Your account uses password only."}
        </p>
        <button
          className={twoFAEnabled ? "danger" : "success"}
          onClick={toggle2FA}
        >
          {twoFAEnabled ? "Disable 2FA" : "Enable 2FA"}
        </button>
      </div>

      {/* ============================
         CHANGE PASSWORD SECTION
      ============================ */}
      <div className="card" style={{ marginTop: 24 }}>
        <h3>Change Password</h3>

        {pwError && <div className="auth-error">{pwError}</div>}
        {pwMessage && <div className="auth-success">{pwMessage}</div>}

        <form onSubmit={handlePasswordChange}>
          <label>Current password</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />

          <label>New password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />

          <label>Confirm new password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          <button disabled={pwLoading} style={{ marginTop: 8 }}>
            {pwLoading ? "Updating..." : "Change password"}
          </button>
        </form>
      </div>

      {error && <p style={{ color: "red", marginTop: 16 }}>{error}</p>}
    </div>
  );
}
