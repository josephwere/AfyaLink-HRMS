import React from 'react';
export const StatCard = ({title, value, subtitle}) => (
  <div className="card stat">
    <div className="card-title">{title}</div>
    <div className="card-value">{value}</div>
    {subtitle && <div className="card-sub">{subtitle}</div>}
  </div>
);
