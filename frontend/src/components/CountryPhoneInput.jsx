import React from "react";
import { getCountryOptions, COUNTRY_DIAL_CODES, toE164FromCountryInput } from "../utils/countryDialCodes";

export default function CountryPhoneInput({
  countryCode,
  onCountryCodeChange,
  localNumber,
  onLocalNumberChange,
  phonePlaceholder = "712345678",
  countryLabel = "Country",
  phoneLabel = "Phone number",
  required = false,
  disabled = false,
}) {
  const countries = React.useMemo(() => getCountryOptions(), []);
  const dialCode = COUNTRY_DIAL_CODES[countryCode] || "";

  return (
    <>
      <label>{countryLabel}</label>
      <select
        value={countryCode || ""}
        onChange={(e) => onCountryCodeChange?.(e.target.value)}
        disabled={disabled}
        required={required}
      >
        <option value="">Select country</option>
        {countries.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name} ({c.code}) {c.dialCode ? ` ${c.dialCode}` : ""}
          </option>
        ))}
      </select>

      <label>{phoneLabel}</label>
      <div className="country-phone-row">
        <input
          value={dialCode}
          readOnly
          aria-label="Dial code"
          className="country-dial-code"
          placeholder="+"
        />
        <input
          value={localNumber}
          onChange={(e) => onLocalNumberChange?.(e.target.value.replace(/[^\d]/g, ""))}
          placeholder={phonePlaceholder}
          disabled={disabled}
          required={required}
          inputMode="numeric"
          pattern="[0-9]*"
        />
      </div>
    </>
  );
}

export function toE164(countryCode, localNumber) {
  return toE164FromCountryInput(countryCode, localNumber);
}
