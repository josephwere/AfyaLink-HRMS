import React, { useState } from "react";

export default function PasswordInput({
  label = "Password",
  value,
  onChange,
  placeholder = "••••••••",
  showStrength = false
}) {
  const [show, setShow] = useState(false);

  const strength = value.length >= 12
    ? "strong"
    : value.length >= 8
    ? "medium"
    : value.length > 0
    ? "weak"
    : "";

  return (
    <div>
      <label>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          type={show ? "text" : "password"}
          value={value}
          placeholder={placeholder}
          onChange={onChange}
          required
        />
        <span
          onClick={() => setShow(!show)}
          style={{
            position: "absolute",
            right: 14,
            top: 12,
            cursor: "pointer",
            userSelect: "none"
          }}
        >
          {show ? "🙈" : "👁️"}
        </span>
      </div>

      {showStrength && value && (
        <div className={`pw-strength ${strength}`}>
          Password strength: <b>{strength}</b>
        </div>
      )}
    </div>
  );
}
