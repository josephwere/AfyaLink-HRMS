import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { apiFetch } from "../utils/apiFetch";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    const token = params.get("token");

    if (!token) {
      setStatus("invalid");
      return;
    }

    apiFetch(`/api/auth/verify-email?token=${token}`)
      .then((res) => {
        if (!res.ok) throw new Error();
        setStatus("success");

        // ⏳ Redirect to login after success
        setTimeout(() => {
          navigate("/login?verified=true");
        }, 3000);
      })
      .catch(() => {
        setStatus("expired");
      });
  }, [params, navigate]);

  return (
    
      <div className={`verify-page ${status}`}>
      {status === "loading" && (
        <>
          <h2>Verifying your email…</h2>
          <p>Please wait a moment.</p>
        </>
      )}

      {status === "success" && (
        <>
          <h2>✅ Email verified successfully!</h2>
          <p>Redirecting you to login…</p>
        </>
      )}

      {status === "invalid" && (
        <>
          <h2>❌ Invalid verification link</h2>
          <p>The verification link is malformed.</p>
          <Link to="/login">Go to Login</Link>
        </>
      )}

      {status === "expired" && (
        <>
          <h2>⏱️ Verification link expired</h2>
          <p>
            Please return to login and request a new verification email.
          </p>
          <Link to="/login">Go to Login</Link>
        </>
      )}
    </div>
  );
  }
