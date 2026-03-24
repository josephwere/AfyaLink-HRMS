import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { getCountyCommandCenterSummary } from "../../services/systemAdminApi";

function regionRisk(row) {
  const pressure = Number(row.pendingTransfers || 0) + Number(row.offlineQueue || 0);
  if (Number(row.machineError || 0) > 0 || Number(row.offlineFailures || 0) > 0 || pressure >= 15) return "risk";
  if (pressure >= 5 || Number(row.offlineClientsOffline || 0) > 0) return "warn";
  return "good";
}

export default function CountyCommandCenter() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [clientMeta, setClientMeta] = useState(null);
  const [region, setRegion] = useState("");
  const regionalSectionRef = useRef(null);
  const requestRef = useRef(0);

  const scrollToSection = (ref) => {
    ref?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const load = useCallback(
    async (selectedRegion = region, { preserveData = false } = {}) => {
      const requestId = requestRef.current + 1;
      requestRef.current = requestId;
      setLoading(true);
      setError("");
      try {
        const res = await getCountyCommandCenterSummary({ region: selectedRegion });
        if (requestRef.current !== requestId) return;
        setData(res?.payload || null);
        setClientMeta(res?.clientMeta || null);
      } catch (err) {
        if (requestRef.current !== requestId) return;
        setError(err?.message || "Failed to load county command center");
        if (!preserveData) setData(null);
      } finally {
        if (requestRef.current === requestId) setLoading(false);
      }
    },
    [region]
  );

  useEffect(() => {
    load("", { preserveData: false });
  }, [load]);

  const hasData = Boolean(data);
  const initialLoading = loading && !hasData;
  const refreshing = loading && hasData;

  const regions = Array.isArray(data?.regions) ? data.regions : [];
  const regionOptions = useMemo(() => {
    if (Array.isArray(data?.allRegions) && data.allRegions.length) return data.allRegions;
    return regions.map((row) => row.region);
  }, [data, regions]);

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>County Command Center</h2>
          <p className="muted">County and group operations view for queues, offline pressure, machines, workforce approvals, and transfer bottlenecks.</p>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate("/admin/offline-ops")}>Offline Ops</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/admin/training-tracker")}>Training Tracker</button>
          <button type="button" className="btn-secondary" onClick={() => navigate("/system-admin/integration-control-plane")}>Integration Control Plane</button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => load(region, { preserveData: hasData })}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="premium-inline-note innovation-console-inline-state">
        <span>
          {refreshing
            ? "Refreshing live county signals while the current workspace stays visible."
            : clientMeta?.attempts > 1
            ? `Loaded after ${clientMeta.attempts} guarded attempts to absorb cold-start latency.`
            : clientMeta?.loadedAt
            ? `Live sync completed ${new Date(clientMeta.loadedAt).toLocaleString()}.`
            : "Warm-start protection is ready for the first live pull."}
        </span>
        {refreshing ? <span className="action-pill">Live sync in progress</span> : null}
      </div>

      {initialLoading ? (
        <section className="section">
          <div className="card premium-card innovation-console-state-card">
            <span className="developer-tool-eyebrow">Warm start</span>
            <strong>Preparing live county signals</strong>
            <p className="muted">
              We are waking the backend and waiting for the first county snapshot so this page does
              not flash a false timeout on cold start.
            </p>
            <div className="innovation-console-skeleton-grid" aria-hidden="true">
              <div className="innovation-console-skeleton" />
              <div className="innovation-console-skeleton" />
              <div className="innovation-console-skeleton" />
              <div className="innovation-console-skeleton" />
            </div>
          </div>
        </section>
      ) : null}

      {error ? (
        <div className="premium-inline-note innovation-console-inline-state innovation-console-inline-state-warn">
          <span>{error}</span>
          <button type="button" className="btn-secondary" onClick={() => load(region, { preserveData: hasData })}>
            Retry now
          </button>
        </div>
      ) : null}

      {hasData ? (
        <>
      <section className="section">
        <h3>Group Snapshot</h3>
        <div className="grid info-grid">
          <StatCard title="Regions" value={data?.summary?.totalRegions ?? 0} onClick={() => scrollToSection(regionalSectionRef)} />
          <StatCard title="Hospitals" value={data?.summary?.totalHospitals ?? 0} onClick={() => navigate("/system-admin/government-hospital-registry")} />
          <StatCard title="Pending Approvals" value={data?.summary?.pendingApprovals ?? 0} onClick={() => navigate("/hospital-admin/approvals")} />
          <StatCard title="Appointments Today" value={data?.summary?.appointmentsToday ?? 0} onClick={() => scrollToSection(regionalSectionRef)} />
          <StatCard title="Regions At Risk" value={data?.summary?.regionsAtRisk ?? 0} onClick={() => scrollToSection(regionalSectionRef)} />
          <StatCard
            title="Bed Occupancy"
            value={`${data?.summary?.bedState?.occupancyRate ?? 0}%`}
            subtitle={`${data?.summary?.bedState?.occupied ?? 0}/${data?.summary?.bedState?.total ?? 0} occupied`}
            onClick={() => navigate("/admin/beds")}
          />
          <StatCard
            title="Low Stock"
            value={data?.summary?.stockRisk?.lowStockItems ?? 0}
            subtitle={`${data?.summary?.stockRisk?.criticalStockItems ?? 0} critical`}
            onClick={() => scrollToSection(regionalSectionRef)}
          />
          <StatCard
            title="Open Outages"
            value={data?.summary?.outages?.open ?? 0}
            subtitle={`${data?.summary?.outages?.sev1 ?? 0} SEV1`}
            onClick={() => navigate("/admin/offline-ops")}
          />
        </div>
      </section>

      <section className="section doctor-main-grid" ref={regionalSectionRef}>
        <div className="card doctor-schedule-card">
          <div className="card-header-actions">
            <h3>Regional Operations</h3>
            <select
              value={region}
              onChange={(e) => {
                const nextRegion = e.target.value;
                setRegion(nextRegion);
                load(nextRegion, { preserveData: hasData });
              }}
            >
              <option value="">All regions</option>
              {regionOptions.map((row) => (
                <option key={row} value={row}>{row}</option>
              ))}
            </select>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Region</th>
                  <th>Hospitals / Staff</th>
                  <th>Transfers</th>
                  <th>Offline</th>
                  <th>Machines</th>
                  <th>Beds</th>
                  <th>Stock / Outages</th>
                  <th>Training</th>
                  <th>Appointments</th>
                </tr>
              </thead>
              <tbody>
                {regions.map((row) => (
                  <tr key={row.region}>
                    <td>
                      <strong>{row.region}</strong>
                      <div className={`status-chip status-${regionRisk(row)}`}>{regionRisk(row).toUpperCase()}</div>
                    </td>
                    <td>
                      <div>{row.hospitals} hospitals</div>
                      <div className="muted">{row.staff} staff | {row.doctors} doctors | {row.nurses} nurses</div>
                    </td>
                    <td>
                      <div>{row.pendingTransfers} pending</div>
                      <div className="muted">{row.overdueTransfers} incomplete handovers</div>
                    </td>
                    <td>
                      <div>Queue {row.offlineQueue}</div>
                      <div className="muted">{row.offlineFailures} failures | {row.offlineClientsOffline}/{row.offlineClients} offline</div>
                    </td>
                    <td>
                      <div>{row.machineOffline} offline</div>
                      <div className="muted">{row.machineError} error</div>
                    </td>
                    <td>
                      <div>{row.occupiedBeds}/{row.totalBeds}</div>
                      <div className="muted">{row.bedOccupancyRate}% occupied</div>
                    </td>
                    <td>
                      <div>{row.lowStockItems} low stock</div>
                      <div className="muted">{row.openOutages} outages | {row.criticalOutages} critical</div>
                    </td>
                    <td>{row.trainingCompletionRate}%</td>
                    <td>{row.appointmentPressure}</td>
                  </tr>
                ))}
                {!regions.length ? (
                  <tr>
                    <td colSpan={9}>No regional operations data yet</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card doctor-alerts-card">
          <h3>Operator Rules</h3>
          <div className="alert-stack">
            <div className="alert-item">Treat machine errors and offline sync failures as same-day county issues.</div>
            <div className="alert-item">Prioritize regions with both transfer backlog and offline queue growth.</div>
            <div className="alert-item">Keep training completion high before expanding new connector rollout.</div>
            <div className="alert-item">Use appointment pressure to trigger workforce redeployment, not only reporting.</div>
          </div>
        </div>
      </section>
        </>
      ) : null}
    </div>
  );
}
