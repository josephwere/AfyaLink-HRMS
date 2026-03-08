import React, { useState } from "react";

function EyeIcon({ open }) {
  return open ? (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        d="M3 3l18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.6 6.3A9.5 9.5 0 0 1 12 6c6 0 9.5 6 9.5 6a16.8 16.8 0 0 1-4.2 4.6M6.7 6.8C4.3 8.3 2.5 12 2.5 12s3.5 6 9.5 6a9.8 9.8 0 0 0 4-.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.9 9.9A3.2 3.2 0 0 0 14.1 14.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function PasswordInput({
  label = "Password",
  id,
  name,
  value,
  onChange,
  placeholder = "••••••••",
  showStrength = false,
  required = false,
  autoComplete = "current-password",
  className = "",
  inputClassName = "",
  disabled = false,
  helperText = "",
}) {
  const [show, setShow] = useState(false);

  const safeValue = String(value || "");
  const strength = safeValue.length >= 12
    ? "strong"
    : safeValue.length >= 8
    ? "medium"
    : safeValue.length > 0
    ? "weak"
    : "";

  return (
    <div className={className}>
      {label ? <label htmlFor={id}>{label}</label> : null}
      <div className="password-input-wrap">
        <input
          id={id}
          name={name}
          className={inputClassName}
          type={show ? "text" : "password"}
          value={safeValue}
          placeholder={placeholder}
          onChange={onChange}
          required={required}
          autoComplete={autoComplete}
          disabled={disabled}
        />
        <span
          role="button"
          tabIndex={disabled ? -1 : 0}
          className="password-toggle-btn"
          onClick={() => !disabled && setShow((prev) => !prev)}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setShow((prev) => !prev);
            }
          }}
          aria-label={show ? "Hide password" : "Show password"}
          title={show ? "Hide password" : "Show password"}
        >
          <EyeIcon open={show} />
        </span>
      </div>

      {helperText ? <div className="muted">{helperText}</div> : null}

      {showStrength && safeValue && (
        <div className={`pw-strength ${strength}`}>
          Password strength: <b>{strength}</b>
        </div>
      )}
    </div>
  );
}
