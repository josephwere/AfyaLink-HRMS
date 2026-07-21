import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { resetPassword } from "../services/resetPasswordApi";
import { normalizeAuthUiError, warmAuthRuntime } from "../services/guardedAuthFetch";

export function useResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Invalid or expired reset link");
    }
  }, [token]);

  useEffect(() => {
    warmAuthRuntime("auth-entry").catch(() => {});
  }, []);

  const submit = useCallback(
    async (e) => {
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
        await resetPassword({ token, password });
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
    },
    [navigate, password, token]
  );

  return { password, setPassword, error, setError, msg, setMsg, loading, submit, token };
}

export default useResetPassword;
