import React from 'react';

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

export const StatCard = ({ title, value, subtitle, trend, status = "neutral" }) => (
  <div className={`card stat stat-${status}`}>
    <div className="card-title">{title}</div>
    <div className="card-value">{value}</div>
    {Array.isArray(trend) && trend.length > 1 && (
      <div style={{ marginTop: 6 }}>
        <Sparkline points={trend} />
      </div>
    )}
    {subtitle && <div className="card-sub">{subtitle}</div>}
  </div>
);
