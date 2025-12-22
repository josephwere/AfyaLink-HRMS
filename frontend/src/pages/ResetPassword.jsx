import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { apiFetch } from "../utils/apiFetch";
import PasswordInput from "../components/PasswordInput";

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
      const res = await apiFetch("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.msg || "Invalid or expired link");
      }

      setMsg("Password reset successful. Redirecting to login...");
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(err.message || "Reset link expired or invalid");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-bg">
      <form className="auth-card" onSubmit={submit}>
        <h1>Reset password</h1>

        {error && <div className="auth-error">{error}</div>}
        {msg && <div className="auth-info">{msg}</div>}

        <PasswordInput
          label="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          showStrength
          required
        />

        <button disabled={loading || !!error}>
          {loading ? "Resetting..." : "Reset password"}
        </button>
      </form>
    </div>
  );
}
