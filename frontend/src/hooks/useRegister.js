import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { redirectByRole } from "../utils/redirectByRole";
import { useAuth } from "../utils/auth";
import { useGoogleAuth } from "../auth/useGoogleAuth.jsx";
import { getCountryOptions } from "../utils/countryDialCodes";
import { useSystemSettings } from "../utils/systemSettings.jsx";
import { enqueueOfflineRegistration, flushOfflineRegistrations } from "../utils/offlineRegistration";
import { guardedAuthFetch, normalizeAuthUiError, warmAuthRuntime } from "../services/guardedAuthFetch";
import { toE164 } from "../components/CountryPhoneInput";

export function useRegister() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { settings } = useSystemSettings();
  const { GoogleButton, error: googleError } = useGoogleAuth();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phoneCountry: "",
    phoneLocal: "",
    nationalIdNumber: "",
    nationalIdCountry: "",
    password: "",
    confirmPassword: "",
  });
  const countries = useMemo(() => getCountryOptions(), []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    document.body.classList.add("auth-route");
    return () => document.body.classList.remove("auth-route");
  }, []);

  useEffect(() => {
    warmAuthRuntime("auth-entry").catch(() => {});
  }, []);

  useEffect(() => {
    const sync = () => {
      flushOfflineRegistrations().catch(() => {});
    };
    sync();
    window.addEventListener("online", sync);
    return () => window.removeEventListener("online", sync);
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
    setInfo("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    const payload = {
      name: form.name.trim(),
      email: form.email ? form.email.toLowerCase().trim() : undefined,
      phone: form.phoneCountry && form.phoneLocal ? toE164(form.phoneCountry, form.phoneLocal) : undefined,
      nationalIdNumber: form.nationalIdNumber || undefined,
      nationalIdCountry: form.nationalIdCountry || undefined,
      password: form.password,
    };

    if (!navigator.onLine) {
      enqueueOfflineRegistration(payload);
      setInfo("Offline: registration saved on this device and will auto-submit when internet returns.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setInfo("");
      const data = await guardedAuthFetch("/api/auth/register", { method: "POST", body: payload });
      if (data.accessToken && data.user) {
        await login(null, { directToken: true, token: data.accessToken, user: data.user });
        setInfo("Account created! Verify your email from Profile inside the app.");
        navigate(redirectByRole(data.user), { replace: true });
      } else {
        setInfo(
          data.phoneOtpSent
            ? "Registration successful. An OTP was sent to your phone. Verify to activate your account."
            : data.msg || "Registration successful. Verify your email from Profile inside the app."
        );
        navigate("/login");
      }
    } catch (err) {
      const msg = err.message || "";
      const networkLike = msg.toLowerCase().includes("network error") || !navigator.onLine;
      if (networkLike) {
        enqueueOfflineRegistration(payload);
        setInfo("Network unavailable. Registration saved offline and will auto-submit when internet returns.");
      } else {
        setError(
          normalizeAuthUiError(err, {
            timeoutMessage: "We’re warming secure account setup and retrying in the background. Please wait a few seconds and try again.",
            networkMessage: "Account setup is temporarily unavailable. Please check your connection and try again.",
            fallback: msg || "Registration failed",
          })
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return {
    form,
    setForm,
    countries,
    submitting,
    error,
    info,
    settings,
    GoogleButton,
    googleError,
    handleChange,
    handleSubmit,
  };
}

export default useRegister;
