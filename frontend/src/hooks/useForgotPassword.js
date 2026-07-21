import { useEffect, useMemo, useState } from "react";
import { useSystemSettings } from "../utils/systemSettings.jsx";
import { normalizeAuthUiError, warmAuthRuntime } from "../services/guardedAuthFetch";
import { requestPasswordReset, requestPhoneResetCode, submitPhoneReset } from "../services/authApi";

function maskEmail(value) {
  const raw = String(value || "").trim();
  if (!raw || !raw.includes("@")) return "";
  const [local, domain] = raw.split("@");
  if (!local || !domain) return raw;
  const visible = local.length <= 2 ? `${local[0] || ""}*` : `${local.slice(0, 2)}***`;
  return `${visible}@${domain}`;
}

export function useForgotPassword() {
  const { settings } = useSystemSettings();
  const [channel, setChannel] = useState("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [phonePassword, setPhonePassword] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [phoneCodeSent, setPhoneCodeSent] = useState(false);
  const [phoneResetComplete, setPhoneResetComplete] = useState(false);

  useEffect(() => {
    document.body.classList.add("auth-route");
    return () => document.body.classList.remove("auth-route");
  }, []);

  useEffect(() => {
    warmAuthRuntime("auth-entry").catch(() => {});
  }, []);

  const submitEmail = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    setError("");

    try {
      await requestPasswordReset({ email });
      setSubmitted(true);
      setMsg("If an AfyaLink account matches this email, a secure reset link is already on the way.");
    } catch (err) {
      setError(
        normalizeAuthUiError(err, {
          timeoutMessage: "Password recovery is warming up. Please wait 20–30 seconds and try again.",
          networkMessage: "Password recovery is temporarily unavailable. Please check your connection and try again.",
          fallback: "Something went wrong",
        })
      );
    } finally {
      setLoading(false);
    }
  };

  const requestPhoneResetCodeHandler = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    setError("");

    try {
      await requestPhoneResetCode({ phone });
      setPhoneResetComplete(false);
      setPhoneCodeSent(true);
      setSubmitted(true);
      setMsg("If an AfyaLink account matches this phone number, a secure reset code is already on the way.");
    } catch (err) {
      setError(
        normalizeAuthUiError(err, {
          timeoutMessage: "Password recovery is warming up. Please wait 20–30 seconds and try again.",
          networkMessage: "Password recovery is temporarily unavailable. Please check your connection and try again.",
          fallback: "Something went wrong",
        })
      );
    } finally {
      setLoading(false);
    }
  };

  const submitPhoneResetHandler = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    setError("");

    try {
      await submitPhoneReset({ phone, otp: phoneOtp, password: phonePassword });
      setPhoneResetComplete(true);
      setMsg("Password reset successful. You can now sign in with the new password.");
      setSubmitted(true);
    } catch (err) {
      setError(
        normalizeAuthUiError(err, {
          timeoutMessage:
            "Password reset verification is taking longer than usual. Please wait a few seconds and try again.",
          networkMessage: "Password reset verification is temporarily unavailable. Please check your connection and try again.",
          fallback: "Invalid or expired reset code",
        })
      );
    } finally {
      setLoading(false);
    }
  };

  const maskedEmail = useMemo(() => maskEmail(email), [email]);
  const maskedPhone = useMemo(() => (phone ? `${phone.slice(0, Math.min(4, phone.length))}${"*".repeat(Math.max(0, phone.length - Math.min(4, phone.length)))}` : ""), [phone]);
  const isEmailMode = channel === "email";

  return {
    settings,
    channel,
    setChannel,
    email,
    setEmail,
    phone,
    setPhone,
    phoneOtp,
    setPhoneOtp,
    phonePassword,
    setPhonePassword,
    msg,
    setMsg,
    error,
    setError,
    loading,
    submitted,
    phoneCodeSent,
    setPhoneCodeSent,
    phoneResetComplete,
    setPhoneResetComplete,
    submitEmail,
    requestPhoneResetCode: requestPhoneResetCodeHandler,
    submitPhoneReset: submitPhoneResetHandler,
    maskedEmail,
    maskedPhone,
    isEmailMode,
  };
}

export default useForgotPassword;
