import React from "react";

export default function EyeIcon({ open, size = 18, className = "" }) {
  const dim = Number(size) || 18;
  return open ? (
    <svg
      viewBox="0 0 24 24"
      width={dim}
      height={dim}
      aria-hidden="true"
      focusable="false"
      className={className}
    >
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
    <svg
      viewBox="0 0 24 24"
      width={dim}
      height={dim}
      aria-hidden="true"
      focusable="false"
      className={className}
    >
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
