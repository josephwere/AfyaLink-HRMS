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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const KENYA_PHONE_REGEX = /^(\+254|254|0)\d{9}$/;

function getValidationMessages(form) {
  const messageMap = {};
  const password = String(form.password || "");
  const confirmPassword = String(form.confirmPassword || "");

  if (!form.name?.trim()) messageMap.name = "This field is required";
  if (form.email && !EMAIL_REGEX.test(form.email)) messageMap.email = "Email address is invalid";
  const fullPhone = `${form.phoneCountry || ""}${form.phoneLocal || ""}`;
  if (form.phoneCountry && form.phoneLocal && !KENYA_PHONE_REGEX.test(fullPhone.replace(/\s+/g, ""))) {
    messageMap.phone = "Enter a valid Kenyan phone number";
  }
  if (!password) messageMap.password = "This field is required";
  if (!confirmPassword) messageMap.confirmPassword = "This field is required";
  if (password && confirmPassword && password !== confirmPassword) messageMap.confirmPassword = "Passwords do not match";
  return messageMap;
}

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
  const [fieldErrors, setFieldErrors] = useState({});

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
    const nextForm = { ...form, [e.target.name]: e.target.value };
    setForm(nextForm);
    setError("");
    setInfo("");
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (e.target.name in next) delete next[e.target.name];
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationErrors = getValidationMessages(form);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setError(Object.values(validationErrors)[0]);
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
    fieldErrors,
    handleChange,
    handleSubmit,
  };
}

export default useRegister;
