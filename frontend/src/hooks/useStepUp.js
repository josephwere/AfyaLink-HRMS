import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { setAccessToken } from "../utils/browserSession";
import { getSessionRisk, requestStepUpCode, verifyStepUpCode } from "../services/stepUpApi";
import { ApiError } from "../utils/apiFetch";

export function useStepUp() {
  const navigate = useNavigate();
  const [sessionRisk, setSessionRisk] = useState(null);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadRisk = useCallback(async () => {
    try {
      const data = await getSessionRisk();
      setSessionRisk(data || null);
    } catch (err) {
      setSessionRisk(null);
      setError(err?.message || "Failed to load session risk");
    }
  }, []);

  useEffect(() => {
    void loadRisk();
  }, [loadRisk]);

  const requestCode = useCallback(async () => {
    setRequesting(true);
    setError("");
    setMessage("");
    try {
      await requestStepUpCode();
      setMessage("Step-up code sent. Check your email or phone.");
    } catch (err) {
      setError(err?.message || "Failed to request step-up code");
    } finally {
      setRequesting(false);
    }
  }, []);

  const verifyCode = useCallback(
    async (e) => {
      e.preventDefault();
      setLoading(true);
      setError("");
      setMessage("");
      try {
        const data = await verifyStepUpCode(otp.trim());
        if (data?.accessToken) {
          setAccessToken(data.accessToken);
        }
        setMessage("Session unlocked successfully.");
        setTimeout(() => navigate(-1), 600);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("Failed to verify step-up code");
        }
      } finally {
        setLoading(false);
      }
    },
    [navigate, otp]
  );

  return {
    sessionRisk,
    otp,
    setOtp,
    loading,
    requesting,
    message,
    error,
    setError,
    setMessage,
    loadRisk,
    requestCode,
    verifyCode,
  };
}

export default useStepUp;
