import React, { useState } from "react";
import EyeIcon from "./EyeIcon";

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
          aria-label={show ? "Hide entered text" : "Show entered text"}
          title={show ? "Hide entered text" : "Show entered text"}
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
