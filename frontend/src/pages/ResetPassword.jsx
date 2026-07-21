import React from "react";
import PasswordInput from "../components/PasswordInput";
import AuthPageShell from "../components/AuthPageShell";
import { useResetPassword } from "../hooks/useResetPassword";

export default function ResetPassword() {
  const { password, setPassword, error, msg, loading, submit } = useResetPassword();

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
