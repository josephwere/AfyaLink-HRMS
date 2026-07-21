import React from "react";
import { useAuth } from "../../utils/auth";

export default function DriverHome() {
  const { user } = useAuth();
  const role = user?.role || user?.actualRole || "DRIVER";

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Driver operations</h2>
          <p className="muted">Track requested transport, update trip status, and stay aligned with dispatch.</p>
        </div>
      </div>

      <div className="card">
        <h3>Today’s logistics</h3>
        <p className="muted">Signed in as {role}. Dispatch, patient handoffs, and trip completion are available from this workspace.</p>
      </div>

      <div className="doctor-main-grid">
        <div className="card">
          <h4>Active trips</h4>
          <p className="muted">0 active assignments</p>
        </div>
        <div className="card">
          <h4>Upcoming pickups</h4>
          <p className="muted">0 scheduled for today</p>
        </div>
      </div>
    </div>
  );
}
