import React from "react";
import { useAuth } from "../../utils/auth";

export default function MortuaryHome() {
  const { user } = useAuth();
  const role = user?.role || user?.actualRole || "MORTUARY_STAFF";

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Mortuary operations</h2>
          <p className="muted">Manage intake, release, and chain-of-custody tasks for the mortuary service.</p>
        </div>
      </div>

      <div className="card">
        <h3>Mortuary queue</h3>
        <p className="muted">Signed in as {role}. Intake and release workflows are available from this workspace.</p>
      </div>

      <div className="doctor-main-grid">
        <div className="card">
          <h4>Pending intake</h4>
          <p className="muted">0 pending items</p>
        </div>
        <div className="card">
          <h4>Release requests</h4>
          <p className="muted">0 pending releases</p>
        </div>
      </div>
    </div>
  );
}
