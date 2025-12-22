import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState("verifying");

  useEffect(() => {
    const token = params.get("token");

    if (!token) {
      setStatus("invalid");
      return;
    }

    fetch(
      `${import.meta.env.VITE_API_URL}/api/auth/verify-email?token=${token}`,
      { credentials: "include" }
    )
      .then(async (res) => {
        if (!res.ok) throw new Error();
        return res.text();
      })
      .then(() => setStatus("success"))
      .catch(() => setStatus("error"));
  }, []);

  return (
    <div style={{ padding: 40, maxWidth: 500 }}>
      <h1>Email Verification</h1>

      {status === "verifying" && <p>Verifying your email…</p>}

      {status === "success" && (
        <>
          <p>✅ Your email has been verified successfully.</p>
          <Link to="/login">Go to Login</Link>
        </>
      )}

      {status === "invalid" && (
        <p>❌ Invalid verification link.</p>
      )}

      {status === "error" && (
        <p>❌ Verification failed or link expired.</p>
      )}
    </div>
  );
}
