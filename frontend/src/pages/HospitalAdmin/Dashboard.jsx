import React, { useEffect, useState } from "react";
import { StatCard } from "../../components/Cards";
import { useAuth } from "../../utils/auth";
import { useNavigate } from "react-router-dom";
import { getHospitalAdminDashboard } from "../../services/dashboardApi";
import { runStaffingForecast } from "../../services/mlApi";
import apiFetch from "../../utils/apiFetch";
import { listTrainingTrackers } from "../../services/trainingTrackerApi";
import { listTransfers } from "../../services/transferApi";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [machineStats, setMachineStats] = useState({
    total: 0,
    online: 0,
    offline: 0,
    error: 0,
    maintenance: 0,
  });
  const [trainingStats, setTrainingStats] = useState({
    total: 0,
    notStarted: 0,
    inProgress: 0,
    completed: 0,
    overdueNotStarted: 0,
    overdueInProgress: 0,
    completionRate: 0,
  });
  const [trend, setTrend] = useState({
    requiredDoctors: [],
    requiredNurses: [],
    doctorGap: [],
    nurseGap: [],
    trainingCompletion: [],
  });
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");

  const push = (key, value) => {
    setTrend((prev) => ({
      ...prev,
      [key]: [...(prev[key] || []), Number(value || 0)].slice(-12),
    }));
  };

  const gapStatus = (v) => {
    const n = Number(v || 0);
    if (n <= 0) return "good";
    if (n <= 3) return "warn";
    return "risk";
  };
  const badgeFromStatus = (s) => (s === "risk" ? "ALERT" : s === "warn" ? "WATCH" : "OK");

  const loadForecast = async () => {
    try {
      const r = await runStaffingForecast({
        beds: 180,
        occupancyRate: 0.76,
        avgPatientsPerDoctor: 12,
        avgPatientsPerNurse: 5,
        horizonDays: 7,
      });
      setForecast(r || null);
      push("requiredDoctors", r?.forecast?.requiredDoctors || 0);
      push("requiredNurses", r?.forecast?.requiredNurses || 0);
      push("doctorGap", r?.forecast?.doctorGap || 0);
      push("nurseGap", r?.forecast?.nurseGap || 0);
    } catch {
      setForecast(null);
    }
  };

  useEffect(() => {
    getHospitalAdminDashboard().then(setData).catch(() => setData(null));
    loadForecast();
    listTrainingTrackers({ hospital: user?.hospital || undefined, limit: 200 })
      .then((res) => {
        const rows = Array.isArray(res?.items) ? res.items : [];
        const now = Date.now();
        const notStarted = rows.filter((r) => r.status === "NOT_STARTED").length;
        const inProgress = rows.filter((r) => r.status === "IN_PROGRESS").length;
        const completed = rows.filter((r) => r.status === "COMPLETED").length;
        const overdueNotStarted = rows.filter(
          (r) =>
            r.status === "NOT_STARTED" &&
            r.createdAt &&
            now - new Date(r.createdAt).getTime() >= 3 * 24 * 60 * 60 * 1000
        ).length;
        const overdueInProgress = rows.filter(
          (r) =>
            r.status === "IN_PROGRESS" &&
            r.updatedAt &&
            now - new Date(r.updatedAt).getTime() >= 7 * 24 * 60 * 60 * 1000
        ).length;
        const total = rows.length;
        const completionRate = total ? Math.round((completed / total) * 100) : 0;
        setTrainingStats({
          total,
          notStarted,
          inProgress,
          completed,
          overdueNotStarted,
          overdueInProgress,
          completionRate,
        });
        push("trainingCompletion", completionRate);
      })
      .catch(() =>
        setTrainingStats({
          total: 0,
          notStarted: 0,
          inProgress: 0,
          completed: 0,
          overdueNotStarted: 0,
          overdueInProgress: 0,
          completionRate: 0,
        })
      );
    listTransfers({ limit: 8, scope: "facility" })
      .then((res) => {
        const items = Array.isArray(res?.items) ? res.items : [];
        setTransfers(items);
        setTransferError("");
      })
      .catch((err) => {
        setTransfers([]);
        setTransferError(err?.message || "Failed to load transfers.");
      });
    apiFetch("/api/machine-connectivity/devices")
      .then((r) => {
        const rows = Array.isArray(r?.items) ? r.items : [];
        setMachineStats({
          total: rows.length,
          online: rows.filter((d) => d.status === "ONLINE").length,
          offline: rows.filter((d) => d.status === "OFFLINE").length,
          error: rows.filter((d) => d.status === "ERROR").length,
          maintenance: rows.filter((d) => d.status === "MAINTENANCE").length,
        });
      })
      .catch(() => {
        setMachineStats({ total: 0, online: 0, offline: 0, error: 0, maintenance: 0 });
      });
    const timer = setInterval(loadForecast, 45000);
    return () => clearInterval(timer);
  }, [user?.hospital]);

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Hospital Admin Dashboard</h2>
          <p className="muted">Simple hospital view for staff, approvals, and daily operations.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-primary" onClick={() => navigate("/hospital-admin/staff")}>Staff Directory</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/appointments")}>Appointment Ops</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/consultation-monitor")}>Consultation Monitor</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/escalations")}>Escalation Queue</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/appointment-analytics")}>Appointment Analytics</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/approvals")}>Leave Approvals</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/register-staff")}>Recruitment Requests</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/recruitment-ads")}>Recruitment Ads</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/commerce-config")}>Insurance & Payments</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/transfer-command-center")}>Transfer Continuity</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/financials")}>Financials</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/machine-connectivity")}>Machine Connectivity</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/customization")}>Branding & Customization</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/pharmacy-referrals")}>Pharmacy Referrals</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/admin/training-tracker?status=IN_PROGRESS")}>Training Tracker</button>
        </div>
      </div>

      <section className="section">
        <h3>Top Metrics</h3>
        <div className="grid info-grid">
          <StatCard title="Staff Count" value={data?.totalStaff ?? "—"} onClick={() => navigate("/hospital-admin/staff")} />
          <StatCard
            title="Bed Occupancy"
            value={`${data?.bedOccupancyRate ?? "—"}%`}
            subtitle={`${data?.occupiedBeds ?? 0}/${data?.totalBeds ?? 0} occupied`}
            onClick={() => navigate("/admin/beds")}
          />
          <StatCard title="Shift Coverage %" value={data?.openShifts ?? "—"} onClick={() => navigate("/workforce/requests#shift")} />
          <StatCard title="Department Alerts" value={data?.pendingRequests ?? "—"} onClick={() => navigate("/hospital-admin/approvals")} />
          <StatCard title="Pending Doctor Assignments" value={data?.pendingAssignments ?? "—"} onClick={() => navigate("/hospital-admin/appointments")} />
          <StatCard title="Active Consultation Calls" value={data?.activeConsultationCalls ?? "—"} onClick={() => navigate("/hospital-admin/appointments")} />
          <StatCard title="Open Ward Escalations" value={data?.escalationSummary?.openCount ?? "—"} onClick={() => navigate("/hospital-admin/consultation-monitor")} />
          <StatCard
            title="Unlinked Pharmacists"
            value={data?.unlinkedPharmacists ?? "—"}
            onClick={() => navigate("/hospital-admin/staff?missingRegisteredPharmacy=1&q=pharmacist")}
          />
          <StatCard
            title="Training Completion %"
            value={trainingStats.completionRate}
            trend={trend.trainingCompletion}
            subtitle={`${trainingStats.completed}/${trainingStats.total} completed`}
            onClick={() => navigate("/admin/training-tracker?status=IN_PROGRESS")}
          />
        </div>
      </section>

      <section className="section">
        <h3>Training Tracker</h3>
        <div className="grid info-grid">
          <StatCard title="Total Trainees" value={trainingStats.total} onClick={() => navigate("/admin/training-tracker")} />
          <StatCard title="Not Started" value={trainingStats.notStarted} onClick={() => navigate("/admin/training-tracker?status=NOT_STARTED")} />
          <StatCard title="In Progress" value={trainingStats.inProgress} onClick={() => navigate("/admin/training-tracker?status=IN_PROGRESS")} />
          <StatCard title="Completed" value={trainingStats.completed} onClick={() => navigate("/admin/training-tracker?status=COMPLETED")} />
          <StatCard title="Overdue Not Started" value={trainingStats.overdueNotStarted} onClick={() => navigate("/admin/training-tracker?status=NOT_STARTED")} />
          <StatCard title="Overdue In Progress" value={trainingStats.overdueInProgress} onClick={() => navigate("/admin/training-tracker?status=IN_PROGRESS")} />
        </div>
      </section>

      <section className="section">
        <h3>AI Staffing Risk</h3>
        <div className="grid info-grid">
          <StatCard title="Required Doctors" value={forecast?.forecast?.requiredDoctors ?? "—"} trend={trend.requiredDoctors} subtitle="Auto-refresh 45s" onClick={() => navigate("/hospital-admin/register-staff?role=doctor")} />
          <StatCard title="Required Nurses" value={forecast?.forecast?.requiredNurses ?? "—"} trend={trend.requiredNurses} subtitle="Auto-refresh 45s" onClick={() => navigate("/hospital-admin/register-staff?role=nurse")} />
          <StatCard
            title="Doctor Gap"
            value={forecast?.forecast?.doctorGap ?? "—"}
            trend={trend.doctorGap}
            subtitle="Auto-refresh 45s"
            status={gapStatus(forecast?.forecast?.doctorGap)}
            badge={badgeFromStatus(gapStatus(forecast?.forecast?.doctorGap))}
            why={`Gap ${forecast?.forecast?.doctorGap ?? 0}; >3 requires urgent staffing intervention.`}
            onBadgeClick={() => navigate("/hospital-admin/register-staff?role=doctor")}
          />
          <StatCard
            title="Nurse Gap"
            value={forecast?.forecast?.nurseGap ?? "—"}
            trend={trend.nurseGap}
            subtitle="Auto-refresh 45s"
            status={gapStatus(forecast?.forecast?.nurseGap)}
            badge={badgeFromStatus(gapStatus(forecast?.forecast?.nurseGap))}
            why={`Gap ${forecast?.forecast?.nurseGap ?? 0}; >3 requires urgent staffing intervention.`}
            onBadgeClick={() => navigate("/hospital-admin/register-staff?role=nurse")}
          />
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <h3>Main Tasks</h3>
          <div className="panel-grid">
            <button type="button" className="action-link" onClick={() => navigate("/workforce/requests#shift")}>Shift Calendar</button>
            <button type="button" className="action-link" onClick={() => navigate("/hospital-admin/appointments")}>Appointment Queue</button>
            <button type="button" className="action-link" onClick={() => navigate("/hospital-admin/appointment-analytics")}>Demand Analytics</button>
            <button type="button" className="action-link" onClick={() => navigate("/hospital-admin/transfer-command-center")}>Transfer Command Center</button>
            <button type="button" className="action-link" onClick={() => navigate("/reports")}>Attendance Heatmap</button>
            <button type="button" className="action-link" onClick={() => navigate("/hospital-admin/staff")}>Staff Directory</button>
            <button type="button" className="action-link" onClick={() => navigate("/hospital-admin/staff?missingRegisteredPharmacy=1&q=pharmacist")}>Fix Pharmacy Links</button>
            <button type="button" className="action-link" onClick={() => navigate("/hospital-admin/financials")}>Budget & Financials</button>
            <button type="button" className="action-link" onClick={() => navigate("/hospital-admin/pharmacy-referrals")}>Nearest Pharmacy Routing</button>
            <button type="button" className="action-link" onClick={() => navigate("/admin/training-tracker?role=NURSE&status=IN_PROGRESS")}>Training Tracker Board</button>
          </div>
        </div>

        <div className="card doctor-alerts-card">
          <h3>Alerts</h3>
          <div className="alert-stack">
            <div className="action-pill">Pending Approvals: {data?.pendingRequests ?? "—"}</div>
            <div className="action-pill">Critical Alerts: {data?.appointmentsToday ?? "—"}</div>
            <div className="action-pill">Pharmacists Linked: {data?.linkedPharmacists ?? "—"}/{data?.pharmacists ?? "—"}</div>
            {(data?.unreadPharmacyRiskNotifications ?? 0) > 0 ? (
              <div className="action-pill" style={{ borderColor: "#ef4444", color: "#ef4444" }}>
                Pharmacy Risk Unread: {data?.unreadPharmacyRiskNotifications}
              </div>
            ) : null}
            {data?.pharmacyCoverageRisk ? (
              <div className="action-pill" style={{ borderColor: "#ef4444", color: "#ef4444" }}>
                Pharmacy feature is on but no pharmacist is linked to a pharmacy.
              </div>
            ) : null}
            {!data?.pharmacyCoverageRisk && data?.pharmacyLinkageWarning ? (
              <div className="action-pill" style={{ borderColor: "#f59e0b", color: "#f59e0b" }}>
                Some pharmacists still need pharmacy links.
              </div>
            ) : null}
            <button type="button" className="btn-secondary" onClick={() => navigate("/notifications")}>Announcements</button>
            {(data?.pharmacyCoverageRisk || data?.pharmacyLinkageWarning) ? (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => navigate("/notifications?category=PHARMACY&read=UNREAD")}
              >
                Pharmacy Risk Alerts{(data?.unreadPharmacyRiskNotifications ?? 0) > 0 ? ` (${data.unreadPharmacyRiskNotifications})` : ""}
              </button>
            ) : null}
            <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/approvals")}>Incident Reports</button>
          </div>
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card doctor-schedule-card">
          <div className="card-header-actions">
            <div>
              <h3>Transfer Continuity</h3>
              <p className="muted">Recent transfers and handoff status.</p>
            </div>
            <div className="action-pill">
              Pending: {transfers.filter((t) => t.status === "Pending").length}
            </div>
          </div>
          {transferError ? <div className="muted">{transferError}</div> : null}
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="doctor-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Route</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t) => (
                  <tr key={t._id}>
                    <td>{t?.patient?.firstName || ""} {t?.patient?.lastName || ""}</td>
                    <td>{t?.fromHospital?.name || t?.fromHospital?.code || "—"} → {t?.toHospital?.name || t?.toHospital?.code || "—"}</td>
                    <td>{t.status}</td>
                  </tr>
                ))}
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="muted">No transfers yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="doctor-actions-row" style={{ marginTop: 12 }}>
            <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/transfer-command-center")}>
              Open Transfer Command Center
            </button>
            <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/ward-board")}>
              Ward Board
            </button>
          </div>
        </div>
        <div className="card doctor-alerts-card">
          <h3>Continuity Actions</h3>
          <div className="alert-stack">
            <div className="alert-item">Confirm consent scopes before export or acceptance.</div>
            <div className="alert-item">Review handover missing fields before completion.</div>
            <div className="alert-item">Escalate pending transfers past 24h.</div>
          </div>
        </div>
      </section>

      <section className="section">
        <h3>Ward Escalations</h3>
        <div className="card">
          <div className="card-header-actions">
            <div>
              <p className="muted">Facility-level view of nurse-raised blockers that need clinician or admin follow-up.</p>
            </div>
            <div className="action-pill warning">Open: {data?.escalationSummary?.openCount ?? 0}</div>
          </div>
          <div className="alert-stack" style={{ marginTop: 12 }}>
            {(data?.escalationSummary?.items || []).slice(0, 8).map((item) => (
              <div key={item.id} className="card">
                <div className="card-header-actions">
                  <div>
                    <strong>{item.patientName}</strong>
                    <div className="muted" style={{ marginTop: 4 }}>
                      {item.resolvedAt ? "Resolved" : "Needs follow-up"}
                      {item.missingRequirements?.length ? ` • Missing: ${item.missingRequirements.join(", ")}` : ""}
                    </div>
                  </div>
                  <div className={`action-pill${item.resolvedAt ? "" : " warning"}`}>
                    {item.resolvedAt ? "Resolved" : "Open"}
                  </div>
                </div>
                <p className="muted" style={{ marginTop: 8 }}>{item.body || item.title}</p>
                <div className="doctor-actions-row" style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => navigate(item.path || "/hospital-admin/escalations")}
                  >
                    Open Workflow
                  </button>
                </div>
              </div>
            ))}
            {!(data?.escalationSummary?.items || []).length ? (
              <div className="action-pill">No ward escalations in this hospital.</div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="section">
        <h3>Ward Occupancy</h3>
        <div className="grid info-grid">
          {Array.isArray(data?.wardOccupancy) && data.wardOccupancy.length ? (
            data.wardOccupancy.map((ward) => (
              <StatCard
                key={ward.ward}
                title={ward.ward}
                value={`${ward.occupancyRate}%`}
                subtitle={`${ward.occupied}/${ward.total} occupied • ${ward.available} available`}
                onClick={() => navigate("/hospital-admin/ward-board")}
              />
            ))
          ) : (
            <div className="card muted">No ward occupancy data yet.</div>
          )}
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card doctor-alerts-card">
          <h3>Recent Bed Activity</h3>
          <div className="alert-stack">
            {Array.isArray(data?.recentBedEvents) && data.recentBedEvents.length ? (
              data.recentBedEvents.map((event) => {
                const moveFrom = [event?.metadata?.fromWard, event?.metadata?.fromNumber].filter(Boolean).join(" - ");
                const moveTo = [event?.metadata?.toWard, event?.metadata?.toNumber].filter(Boolean).join(" - ");
                return (
                  <div key={event._id} className="alert-item">
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <strong>{String(event.action || "").replaceAll("_", " ")}</strong>
                      <span className="muted">{new Date(event.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="muted">
                      By {event?.actor?.name || "System"}{event?.actor?.role ? ` • ${event.actor.role}` : ""}
                    </div>
                    {moveFrom || moveTo ? (
                      <div className="muted">
                        {moveFrom || "Unknown"} {" -> "} {moveTo || "Unknown"}
                      </div>
                    ) : null}
                    {event?.metadata?.ward || event?.metadata?.number ? (
                      <div className="muted">
                        Bed: {[event?.metadata?.ward, event?.metadata?.number].filter(Boolean).join(" - ")}
                      </div>
                    ) : null}
                    {event?.metadata?.note ? <div>{event.metadata.note}</div> : null}
                  </div>
                );
              })
            ) : (
              <div className="card muted">No bed movement events yet.</div>
            )}
            <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/ward-board")}>
              Open Bed Operations
            </button>
          </div>
        </div>

        <div className="card doctor-schedule-card">
          <h3>Ward Actions</h3>
          <div className="panel-grid">
            <button type="button" className="action-link" onClick={() => navigate("/hospital-admin/ward-board")}>Assign Beds</button>
            <button type="button" className="action-link" onClick={() => navigate("/hospital-admin/ward-board")}>Transfer Patients</button>
            <button type="button" className="action-link" onClick={() => navigate("/hospital-admin/ward-board")}>Discharge Beds</button>
            <button type="button" className="action-link" onClick={() => navigate("/hospital-admin/transfer-command-center")}>Transfer Continuity</button>
          </div>
        </div>
      </section>

      <section className="section">
        <h3>Machine Connectivity</h3>
        <div className="grid info-grid">
          <StatCard title="Connected Devices" value={machineStats.total} onClick={() => navigate("/hospital-admin/machine-connectivity")} />
          <StatCard title="Online" value={machineStats.online} onClick={() => navigate("/hospital-admin/machine-connectivity")} />
          <StatCard title="Offline" value={machineStats.offline} onClick={() => navigate("/hospital-admin/machine-connectivity")} />
          <StatCard title="Error" value={machineStats.error} onClick={() => navigate("/hospital-admin/machine-alerts")} />
          <StatCard title="Maintenance" value={machineStats.maintenance} onClick={() => navigate("/hospital-admin/machine-connectivity")} />
        </div>
        <div className="action-list" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="action-link"
            onClick={() => navigate("/hospital-admin/machine-connectivity")}
          >
            Open Machine Connectivity Console
          </button>
          <button
            type="button"
            className="action-link"
            onClick={() => navigate("/hospital-admin/machine-alerts")}
          >
            View Machine Alerts
          </button>
        </div>
      </section>
    </div>
  );
}
