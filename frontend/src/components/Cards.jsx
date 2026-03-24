import React from 'react';
import { useNavigate } from "react-router-dom";
import { useAppLanguage } from "../utils/appLanguage.jsx";

function Sparkline({ points = [] }) {
  const nums = (points || []).map((v) => Number(v)).filter((v) => Number.isFinite(v));
  if (nums.length < 2) return null;
  const width = 120;
  const height = 28;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;
  const step = width / Math.max(1, nums.length - 1);
  const path = nums
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / span) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline
        fill="none"
        stroke="var(--app-accent-2, #2563eb)"
        strokeWidth="2"
        points={path}
      />
    </svg>
  );
}

export const StatCard = ({
  title,
  value,
  subtitle,
  trend,
  variant = "medium",
  status = "neutral",
  why = "",
  badge = "",
  onBadgeClick = null,
  onClick = null,
  path = "",
}) => {
  const navigate = useNavigate();
  const { translateText } = useAppLanguage();
  const handleOpen = typeof onClick === "function"
    ? onClick
    : path
      ? () => navigate(path)
      : null;

  return (
    <div
      className={`card premium-card stat stat-${status} stat-${variant}${typeof handleOpen === "function" ? " stat-clickable" : ""}`}
      onClick={typeof handleOpen === "function" ? handleOpen : undefined}
      role={typeof handleOpen === "function" ? "button" : undefined}
      tabIndex={typeof handleOpen === "function" ? 0 : undefined}
      onKeyDown={
        typeof handleOpen === "function"
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") handleOpen();
            }
          : undefined
      }
    >
      <div className="card-title-row">
        <div className="card-title">{typeof title === "string" ? translateText(title) : title}</div>
        {badge ? (
          typeof onBadgeClick === "function" ? (
            <button
              type="button"
              className={`stat-badge stat-badge-${status}`}
              onClick={onBadgeClick}
            >
              {typeof badge === "string" ? translateText(badge) : badge}
            </button>
          ) : (
            <span className={`stat-badge stat-badge-${status}`}>{typeof badge === "string" ? translateText(badge) : badge}</span>
          )
        ) : null}
      </div>
      <div className="card-value">{value}</div>
      {why ? <div className="card-why" title={typeof why === "string" ? translateText(why) : why}>{translateText("Why")}: {typeof why === "string" ? translateText(why) : why}</div> : null}
      {Array.isArray(trend) && trend.length > 1 && (
        <div style={{ marginTop: 6 }}>
          <Sparkline points={trend} />
        </div>
      )}
      {subtitle && <div className="card-sub">{typeof subtitle === "string" ? translateText(subtitle) : subtitle}</div>}
    </div>
  );
};

export const ActionCard = ({
  title,
  description = "",
  eyebrow = "",
  badge = "",
  variant = "medium",
  controls = null,
  footerLabel = "Open workflow",
  path = "",
  onClick = null,
}) => {
  const navigate = useNavigate();
  const { translateText } = useAppLanguage();

  const handleOpen =
    typeof onClick === "function" ? onClick : path ? () => navigate(path) : null;

  return (
    <div
      className={`card premium-card action-card action-card-${variant}${handleOpen ? " stat-clickable" : ""}`}
      onClick={handleOpen || undefined}
      role={handleOpen ? "button" : undefined}
      tabIndex={handleOpen ? 0 : undefined}
      onKeyDown={
        handleOpen
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") handleOpen();
            }
          : undefined
      }
    >
      <div className="action-card-head">
        <div>
          {eyebrow ? <div className="action-card-eyebrow">{translateText(eyebrow)}</div> : null}
          <div className="action-card-title">{translateText(title)}</div>
        </div>
        <div className="action-card-head-right">
          {controls ? <div className="action-card-controls" onClick={(event) => event.stopPropagation()}>{controls}</div> : null}
          {badge ? <span className="stat-badge stat-badge-neutral">{translateText(badge)}</span> : null}
        </div>
      </div>
      {description ? <p className="action-card-description">{translateText(description)}</p> : null}
      <div className="action-card-footer">{translateText(footerLabel)}</div>
    </div>
  );
};
