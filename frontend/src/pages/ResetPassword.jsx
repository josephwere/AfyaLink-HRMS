import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import PasswordInput from "../components/PasswordInput";
import AuthPageShell from "../components/AuthPageShell";
import {
  guardedAuthFetch,
  normalizeAuthUiError,
  warmAuthRuntime,
} from "../services/guardedAuthFetch";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const token = params.get("token");

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  /* ---------------------------------------
     Guard: missing token
  ---------------------------------------- */
  useEffect(() => {
    if (!token) {
      setError("Invalid or expired reset link");
    }
  }, [token]);

  useEffect(() => {
    warmAuthRuntime("auth-entry").catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setMsg("");
    setLoading(true);

    if (!token) {
      setError("Invalid or expired reset link");
      setLoading(false);
      return;
    }

    try {
      await guardedAuthFetch("/api/auth/reset-password", {
        method: "POST",
        body: { token, password },
      });

      setMsg("Password reset successful. Redirecting to login...");
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(
        normalizeAuthUiError(err, {
          timeoutMessage:
            "Password reset is taking longer than usual. Please wait a few seconds and try again.",
          networkMessage:
            "Password reset is temporarily unavailable. Please check your connection and try again.",
          fallback: "Reset link expired or invalid",
        })
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageShell>
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-kicker">Password recovery</div>
        <h1>Reset password</h1>
        <p className="subtitle">
          Set a new password for this account. Use a password you have not used on another site.
        </p>

        {error && <div className="auth-error">{error}</div>}
        {msg && <div className="auth-info">{msg}</div>}

        <PasswordInput
          label="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          showStrength
          required
        />

        <button type="submit" disabled={loading || !!error}>
          {loading ? "Resetting..." : "Reset password"}
        </button>
      </form>
    </AuthPageShell>
  );
}
