import React, { useState } from "react";

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
        <button
          type="button"
          className="password-toggle-btn"
          onClick={() => setShow((prev) => !prev)}
          aria-label={show ? "Hide password" : "Show password"}
          title={show ? "Hide password" : "Show password"}
          disabled={disabled}
        >
          {show ? "Hide" : "Show"}
        </button>
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
