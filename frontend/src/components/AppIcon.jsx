import React from "react";

const DEFAULT_SIZE = 18;

function IconFrame({ size = DEFAULT_SIZE, children, ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

const iconMap = {
  menu: (size) => (
    <IconFrame size={size}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </IconFrame>
  ),
  more: (size) => (
    <IconFrame size={size}>
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </IconFrame>
  ),
  sun: (size) => (
    <IconFrame size={size}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" />
    </IconFrame>
  ),
  moon: (size) => (
    <IconFrame size={size}>
      <path d="M20 14.2A7.8 7.8 0 1 1 9.8 4 6.5 6.5 0 0 0 20 14.2Z" />
    </IconFrame>
  ),
  search: (size) => (
    <IconFrame size={size}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 5 5" />
    </IconFrame>
  ),
  panel: (size) => (
    <IconFrame size={size}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <path d="M14.5 4.5v15" />
    </IconFrame>
  ),
  home: (size) => (
    <IconFrame size={size}>
      <path d="m3.5 10.5 8.5-6.5 8.5 6.5" />
      <path d="M6 9.5V20h12V9.5" />
    </IconFrame>
  ),
  admin: (size) => (
    <IconFrame size={size}>
      <path d="M12 3.5 5.5 6v5.8c0 4 2.7 7.6 6.5 8.7 3.8-1.1 6.5-4.7 6.5-8.7V6L12 3.5Z" />
      <path d="m9.5 12 1.6 1.7 3.4-3.8" />
    </IconFrame>
  ),
  hr: (size) => (
    <IconFrame size={size}>
      <circle cx="9" cy="9" r="3" />
      <circle cx="16.5" cy="10" r="2.5" />
      <path d="M4 19c.7-2.7 2.7-4 5-4s4.3 1.3 5 4" />
      <path d="M14.5 18c.5-1.9 1.9-3 4-3 1 0 1.9.2 2.5.7" />
    </IconFrame>
  ),
  payroll: (size) => (
    <IconFrame size={size}>
      <rect x="3.5" y="6" width="17" height="12" rx="2.5" />
      <path d="M3.5 10h17" />
      <path d="M7.5 14.5h3M15 14.5h1.5" />
    </IconFrame>
  ),
  doctor: (size) => (
    <IconFrame size={size}>
      <circle cx="12" cy="7.5" r="3" />
      <path d="M7 20c.7-3 2.5-4.8 5-4.8S16.3 17 17 20" />
      <path d="M18.5 7.5v4M16.5 9.5h4" />
    </IconFrame>
  ),
  nurse: (size) => (
    <IconFrame size={size}>
      <path d="M8 4.5h8v3l-4 2.5-4-2.5Z" />
      <circle cx="12" cy="13" r="3.2" />
      <path d="M12 11.3v3.4M10.3 13h3.4" />
      <path d="M7 20c.7-2.1 2.3-3.4 5-3.4s4.3 1.3 5 3.4" />
    </IconFrame>
  ),
  lab: (size) => (
    <IconFrame size={size}>
      <path d="M10 3.5v5l-5.2 8.6A2 2 0 0 0 6.5 20h11a2 2 0 0 0 1.7-2.9L14 8.5v-5" />
      <path d="M8.5 12h7" />
    </IconFrame>
  ),
  pharmacy: (size) => (
    <IconFrame size={size}>
      <rect x="4.5" y="7.5" width="15" height="9" rx="4.5" transform="rotate(-35 12 12)" />
      <path d="m9.3 9.3 5.4 5.4" />
    </IconFrame>
  ),
  staff: (size) => (
    <IconFrame size={size}>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 20c.9-3.3 3.2-5 6.5-5s5.6 1.7 6.5 5" />
    </IconFrame>
  ),
  security: (size) => (
    <IconFrame size={size}>
      <rect x="4.5" y="11" width="15" height="9" rx="2.5" />
      <path d="M8 11V8a4 4 0 1 1 8 0v3" />
      <circle cx="12" cy="15.5" r="1" />
    </IconFrame>
  ),
  settings: (size) => (
    <IconFrame size={size}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3.5v2.2M12 18.3v2.2M4.7 7.2l1.6 1.2M17.7 15.6l1.6 1.2M3.5 12h2.2M18.3 12h2.2M4.7 16.8l1.6-1.2M17.7 8.4l1.6-1.2" />
    </IconFrame>
  ),
  analytics: (size) => (
    <IconFrame size={size}>
      <path d="M5 19.5V10.5M12 19.5V6.5M19 19.5v-12" />
      <path d="M3.5 19.5h17" />
    </IconFrame>
  ),
  reports: (size) => (
    <IconFrame size={size}>
      <path d="M7 3.5h7l4 4v13H7z" />
      <path d="M14 3.5v4h4M9.5 12h5M9.5 16h5" />
    </IconFrame>
  ),
  notifications: (size) => (
    <IconFrame size={size}>
      <path d="M7.5 16.5V10a4.5 4.5 0 0 1 9 0v6.5l1.5 1.5h-12Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </IconFrame>
  ),
  requests: (size) => (
    <IconFrame size={size}>
      <rect x="4.5" y="4.5" width="15" height="15" rx="2.5" />
      <path d="M8 9h8M8 13h8M8 17h5" />
    </IconFrame>
  ),
  inventory: (size) => (
    <IconFrame size={size}>
      <path d="M4.5 7.5 12 3.5l7.5 4v9L12 20.5l-7.5-4z" />
      <path d="M4.5 7.5 12 12l7.5-4M12 12v8.5" />
    </IconFrame>
  ),
  ai: (size) => (
    <IconFrame size={size}>
      <rect x="7" y="7" width="10" height="10" rx="2.5" />
      <path d="M10 12h4M12 10v4M9 4.5v2M15 4.5v2M9 17.5v2M15 17.5v2M4.5 9h2M17.5 9h2M4.5 15h2M17.5 15h2" />
    </IconFrame>
  ),
  appointments: (size) => (
    <IconFrame size={size}>
      <rect x="4.5" y="5.5" width="15" height="14" rx="2.5" />
      <path d="M8 3.5v4M16 3.5v4M4.5 9.5h15M9 13h2.5v2.5H9z" />
    </IconFrame>
  ),
  printer: (size) => (
    <IconFrame size={size}>
      <path d="M7 8V4.5h10V8" />
      <rect x="5" y="10" width="14" height="6" rx="2" />
      <path d="M7 14.5h10V20H7zM16 12.5h1.5" />
    </IconFrame>
  ),
  shield: (size) => (
    <IconFrame size={size}>
      <path d="M12 3.5 5.5 6v5.8c0 4 2.7 7.6 6.5 8.7 3.8-1.1 6.5-4.7 6.5-8.7V6L12 3.5Z" />
    </IconFrame>
  ),
  account: (size) => (
    <IconFrame size={size}>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 20c.9-3.3 3.2-5 6.5-5s5.6 1.7 6.5 5" />
    </IconFrame>
  ),
  star: (size) => (
    <IconFrame size={size}>
      <path d="m12 4.5 2.3 4.7 5.2.8-3.8 3.7.9 5.3L12 16.5 7.4 19l.9-5.3-3.8-3.7 5.2-.8z" />
    </IconFrame>
  ),
};

export default function AppIcon({ name, size = DEFAULT_SIZE, className = "" }) {
  const render = iconMap[name] || iconMap.settings;
  return <span className={`app-icon ${className}`.trim()}>{render(size)}</span>;
}
