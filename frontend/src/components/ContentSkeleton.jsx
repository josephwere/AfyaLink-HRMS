import React from "react";

export default function ContentSkeleton({
  title = "Loading content",
  rows = 4,
  cards = 3,
  variant = "cards",
}) {
  const rowItems = Array.from({ length: rows }, (_, index) => index);
  const cardItems = Array.from({ length: cards }, (_, index) => index);

  return (
    <div className={`content-skeleton content-skeleton-${variant}`} role="status" aria-live="polite" aria-label={title}>
      <div className="content-skeleton-head">
        <div className="skeleton skeleton-line" style={{ width: "38%", height: 16 }} />
        <div className="skeleton skeleton-pill" style={{ width: 140 }} />
      </div>
      {variant === "table" ? (
        <div className="content-skeleton-table">
          {rowItems.map((item) => (
            <div className="content-skeleton-row" key={item}>
              <div className="skeleton skeleton-line" style={{ width: "24%" }} />
              <div className="skeleton skeleton-line" style={{ width: "38%" }} />
              <div className="skeleton skeleton-line" style={{ width: "18%" }} />
              <div className="skeleton skeleton-pill" style={{ width: 96 }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="content-skeleton-grid">
          {cardItems.map((item) => (
            <div className="content-skeleton-card" key={item}>
              <div className="skeleton skeleton-line" style={{ width: "55%", height: 14 }} />
              <div className="skeleton skeleton-line" style={{ width: "90%" }} />
              <div className="skeleton skeleton-line" style={{ width: "76%" }} />
              <div className="skeleton skeleton-card" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
