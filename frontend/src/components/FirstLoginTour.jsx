import React, { useEffect, useState } from "react";
import { useAuth } from "../utils/auth";

export default function FirstLoginTour() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    const key = `tour_seen_${user.id}`;
    const seen = localStorage.getItem(key) === "true";
    if (!seen) setOpen(true);
  }, [user?.id]);

  const close = () => {
    if (user?.id) {
      localStorage.setItem(`tour_seen_${user.id}`, "true");
    }
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="tour-backdrop" role="dialog" aria-modal="true">
      <div className="tour-modal">
        <button className="tour-close" onClick={close} aria-label="Close">
          ×
        </button>
        <h3>Welcome to AfyaLink HRMS</h3>
        <p className="muted">
          Here’s a quick guide to get you started. You can revisit this anytime
          from Help.
        </p>
        <ul className="tour-list">
          <li>Use the navigator to switch dashboards and modules.</li>
          <li>Search across people, tasks, and reports from the top bar.</li>
          <li>Complete your verification in Profile for full access.</li>
          <li>Check alerts for approvals, requests, and system notices.</li>
        </ul>
        <div className="tour-actions">
          <button className="btn-secondary" onClick={close}>
            Skip
          </button>
          <button className="btn-primary" onClick={close}>
            Start
          </button>
        </div>
      </div>
    </div>
  );
}
