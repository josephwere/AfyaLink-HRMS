import React from "react";

export default function StatCard({ title, value }) {
  return (
    <div className="premium-card mini-stat-card">
      <h4>{title}</h4>
      <div className="mini-stat-card__value">{value}</div>
    </div>
  );
}
