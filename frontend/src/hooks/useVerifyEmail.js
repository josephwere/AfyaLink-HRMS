import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { verifyEmailToken, resendVerificationEmail } from "../services/authApi";

export function useVerifyEmail() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState("verifying");
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const token = params.get("token");

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }

    Promise.resolve(verifyEmailToken(token))
      .then(() => setStatus("success"))
      .catch(() => setStatus("error"));
  }, [token]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handleResend = async () => {
    try {
      setLoading(true);
      const data = await resendVerificationEmail(email);
      setCooldown(data.retryAfter || 60);
      setMessage("Verification email sent. Check your inbox and spam folder.");
    } catch {
      setMessage("We could not send a new verification email. Check the address and try again.");
    } finally {
      setLoading(false);
    }
  };

  return { status, cooldown, loading, email, setEmail, message, setMessage, token, handleResend };
}

export default useVerifyEmail;
