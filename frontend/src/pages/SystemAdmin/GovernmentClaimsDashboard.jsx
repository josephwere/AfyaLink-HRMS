import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import DashboardHomeShell from "../../components/DashboardHomeShell";
import useGovernmentClaimsDashboard from "../../hooks/useGovernmentClaimsDashboard";

const emptyOverview = {
  summary: {
    totalClaims: 0,
    approved: 0,
    rejected: 0,
    pending: 0,
    reviewRequired: 0,
    paid: 0,
    fraudOpen: 0,
    fraudHigh: 0,
    hospitalsTotal: 0,
    patientsTotal: 0,
    patientsVerified: 0,
    patientsUnverified: 0,
    compliantHospitals: 0,
    nonCompliantHospitals: 0,
    totalAmount: 0,
    approvedAmount: 0,
    rejectedAmount: 0,
    pendingAmount: 0,
    reviewAmount: 0,
  },
  trends: [],
  riskMap: [],
  hospitalMonitoring: [],
  providerSummary: [],
  currencySummary: [],
  proceduresSummary: [],
  fraudSeverity: {},
  fraudSignals: [],
  suspiciousClaims: [],
  funds: [],
  notifications: [],
};

const buildQuery = (filters = {}) => {
  const qs = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      qs.set(key, value);
    }
  });
  return qs.toString();
};

const formatNumber = (value) => new Intl.NumberFormat().format(Number(value || 0));

const formatMoney = (value, currency = "KES") => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(Number(value || 0));
  } catch {
    return `${currency} ${formatNumber(value)}`;
  }
};

const riskClass = (score = 0) => {
  const value = Number(score || 0);
  if (value >= 75) return "status-chip status-risk";
  if (value >= 40) return "status-chip status-warn";
  return "status-chip status-good";
};

const complianceClass = (status) => (status === "COMPLIANT" ? "status-chip status-good" : "status-chip status-risk");

const CHART_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function GovernmentClaimsDashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState({
    from: searchParams.get("from") || "",
    to: searchParams.get("to") || "",
    country: searchParams.get("country") || "",
    provider: searchParams.get("provider") || "",
    hospitalId: searchParams.get("hospitalId") || "",
  });
  const [claimsFilters, setClaimsFilters] = useState({
    status: searchParams.get("status") || "",
    riskMin: searchParams.get("riskMin") || "",
    riskMax: searchParams.get("riskMax") || "",
    patientId: searchParams.get("patientId") || "",
    procedure: searchParams.get("procedure") || "",
  });
  const [alertFilters, setAlertFilters] = useState({ status: "", severity: "" });

  const dashboardFilters = useMemo(() => ({ ...filters, ...claimsFilters }), [filters, claimsFilters]);

  const {
    overview,
    claims,
    fraudAlerts,
    hospitals,
    inspections,
    enforcements,
    healthFunds,
    auditLogs,
    notifications,
    loading,
    msg,
    missingApi,
    apiStatus,
    auditOpen,
    auditClaim,
    auditTrail,
    auditLoading,
    patientQuery,
    setPatientQuery,
    patientHistory,
    patientLoading,
    inspectionForm,
    setInspectionForm,
    enforcementForm,
    setEnforcementForm,
    fundForm,
    setFundForm,
    loadAll,
    loadClaims,
    loadFraudAlerts,
    loadOverview,
    openAudit,
    closeAudit,
    reviewClaim,
    requestVerification,
    assignAudit,
    runPatientSearch,
    createInspection,
    updateInspectionStatus,
    createEnforcement,
    updateEnforcementStatus,
    createHealthFund,
    updateHealthFund,
  } = useGovernmentClaimsDashboard(dashboardFilters, alertFilters);
  const highlightedClaimId = searchParams.get("claimId") || "";
  const autoOpenedClaimRef = useRef("");
  const claimsSectionRef = useRef(null);
  const fraudSectionRef = useRef(null);
  const reportingSectionRef = useRef(null);

  const scrollToSection = (ref) => {
    ref?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openClaimsSlice = (status = "") => {
    setClaimsFilters((prev) => ({ ...prev, status }));
    void loadClaims({ status });
    scrollToSection(claimsSectionRef);
  };

  const openFraudSlice = (overrides = {}) => {
    setAlertFilters((prev) => ({ ...prev, ...overrides }));
    void loadFraudAlerts(overrides);
    scrollToSection(fraudSectionRef);
  };

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!highlightedClaimId || !claims.length || autoOpenedClaimRef.current === highlightedClaimId) return;
    const matched = claims.some((claim) => String(claim._id) === String(highlightedClaimId));
    if (!matched) return;
    autoOpenedClaimRef.current = highlightedClaimId;
    void openAudit(highlightedClaimId);
  }, [claims, highlightedClaimId, openAudit]);

  useEffect(() => {
    if (hospitals.length && !inspectionForm.hospitalId) {
      setInspectionForm((prev) => ({ ...prev, hospitalId: hospitals[0].id || hospitals[0]._id || "" }));
    }
    if (hospitals.length && !enforcementForm.hospitalId) {
      setEnforcementForm((prev) => ({ ...prev, hospitalId: hospitals[0].id || hospitals[0]._id || "" }));
    }
  }, [hospitals, inspectionForm.hospitalId, enforcementForm.hospitalId, setInspectionForm, setEnforcementForm]);

  const downloadCsv = (filename, rows) => {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const escape = (value) => {
      const str = String(value ?? "");
      if (str.includes(",") || str.includes("\n") || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    const csv = [headers.join(","), ...rows.map((row) => headers.map((h) => escape(row[h])).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const trendRows = useMemo(() => overview?.trends || [], [overview]);
  const riskMap = useMemo(() => overview?.riskMap || [], [overview]);
  const providerSummary = useMemo(() => overview?.providerSummary || [], [overview]);
  const currencySummary = useMemo(() => overview?.currencySummary || [], [overview]);
  const proceduresSummary = useMemo(() => overview?.proceduresSummary || [], [overview]);
  const fraudSignals = useMemo(() => overview?.fraudSignals || [], [overview]);
  const suspiciousClaims = useMemo(() => overview?.suspiciousClaims || [], [overview]);
  const hospitalMonitoring = useMemo(() => overview?.hospitalMonitoring || [], [overview]);

  const fraudSeverityData = useMemo(() => {
    const severity = overview?.fraudSeverity || {};
    return Object.entries(severity).map(([label, value]) => ({ label, value }));
  }, [overview]);

  const complianceData = useMemo(
    () => [
      { label: "Compliant", value: overview.summary.compliantHospitals || 0 },
      { label: "Non-Compliant", value: overview.summary.nonCompliantHospitals || 0 },
    ],
    [overview]
  );

  const overviewCards = [
    {
      label: "Total Claims",
      value: formatNumber(overview.summary.totalClaims),
      onClick: () => openClaimsSlice(""),
    },
    {
      label: "Approved",
      value: formatNumber(overview.summary.approved),
      onClick: () => openClaimsSlice("APPROVED"),
    },
    {
      label: "Rejected",
      value: formatNumber(overview.summary.rejected),
      onClick: () => openClaimsSlice("REJECTED"),
    },
    {
      label: "Pending",
      value: formatNumber(overview.summary.pending),
      onClick: () => openClaimsSlice("PENDING"),
    },
    {
      label: "Review Required",
      value: formatNumber(overview.summary.reviewRequired),
      onClick: () => openClaimsSlice("REVIEW_REQUIRED"),
    },
    {
      label: "Fraud Alerts",
      value: formatNumber(overview.summary.fraudOpen),
      onClick: () => openFraudSlice({}),
    },
    {
      label: "Hospitals Registered",
      value: formatNumber(overview.summary.hospitalsTotal),
      onClick: () => navigate("/app/governance/registry/hospitals"),
    },
    {
      label: "Patients Verified",
      value: formatNumber(overview.summary.patientsVerified),
      onClick: () => navigate("/app/governance/registry/patient-identity"),
    },
    {
      label: "Total Amount",
      value: formatMoney(overview.summary.totalAmount, "KES"),
      onClick: () => scrollToSection(reportingSectionRef),
    },
    {
      label: "Compliant Hospitals",
      value: formatNumber(overview.summary.compliantHospitals),
      onClick: () => navigate("/app/governance/registry/hospitals"),
    },
  ];

  const claimExportRows = useMemo(
    () =>
      claims.map((claim) => ({
        id: claim._id,
        status: claim.status,
        hospital: claim.hospital?.name || "",
        patient: claim.patient ? `${claim.patient.firstName || ""} ${claim.patient.lastName || ""}`.trim() : "",
        amount: claim.totalAmount,
        currency: claim.currency,
        provider: claim.provider?.code || "",
        riskScore: claim.riskScore,
        createdAt: claim.createdAt,
      })),
    [claims]
  );

  const hospitalExportRows = useMemo(
    () =>
      hospitalMonitoring.map((row) => ({
        hospital: row.name,
        code: row.code,
        country: row.country,
        region: row.region,
        complianceScore: row.complianceScore,
        complianceStatus: row.complianceStatus,
        verificationStatus: row.verificationStatus,
        licenseStatus: row.licenseStatus,
        inspectionScore: row.inspectionScore,
        enforcementOpen: row.enforcementOpen,
        totalClaims: row.totalClaims,
        rejectedClaims: row.rejectedClaims,
      })),
    [hospitalMonitoring]
  );

  const apiBadgeClass = useMemo(() => {
    if (apiStatus.state === "ok") return "status-chip status-good";
    if (apiStatus.state === "warn") return "status-chip status-warn";
    if (apiStatus.state === "risk") return "status-chip status-risk";
    if (apiStatus.state === "checking") return "status-chip status-warn";
    return "status-chip status-muted";
  }, [apiStatus.state]);

  const apiBadgeLabel = useMemo(() => {
    if (apiStatus.state === "ok") return "API Healthy";
    if (apiStatus.state === "warn") return "API Partial";
    if (apiStatus.state === "risk") return "API Down";
    if (apiStatus.state === "checking") return "API Checking";
    return "API Unknown";
  }, [apiStatus.state]);

  const apiBadgeTooltip = useMemo(() => {
    const lastSuccess = apiStatus.lastSuccessAt
      ? new Date(apiStatus.lastSuccessAt).toLocaleString()
      : "Never";
    const lastCheck = apiStatus.lastChecked
      ? new Date(apiStatus.lastChecked).toLocaleString()
      : "Not checked yet";
    return `${apiStatus.detail || "Government API status."}\nLast success: ${lastSuccess}\nLast check: ${lastCheck}`;
  }, [apiStatus.detail, apiStatus.lastChecked, apiStatus.lastSuccessAt]);

  return (
    <DashboardHomeShell
      shellKey="governance_government_claims"
      kicker="Governance"
      title="Government Claims"
      subtitle="End-to-end national oversight for claims, compliance, inspections, and fraud prevention."
      actions={[
        { label: loading ? "Refreshing..." : "Refresh", onClick: loadAll, variant: "secondary", disabled: loading },
        { label: "Hospital Registry", path: "/app/governance/registry/hospitals", variant: "secondary" },
        { label: "Patient Identity", path: "/app/governance/registry/patient-identity", variant: "secondary" },
      ]}
    >

      <div className="card connection-banner">
        <div className="connection-status">
          <span
            className={`status-blink ${
              apiStatus.state === "ok"
                ? "status-blink-green"
                : apiStatus.state === "warn" || apiStatus.state === "risk"
                  ? "status-blink-red"
                  : "status-blink-amber"
            }`}
            aria-hidden="true"
          />
          <strong>
            {apiStatus.state === "ok"
              ? "Government API Connected"
              : apiStatus.state === "warn"
                ? "Government API Not Available"
                : apiStatus.state === "risk"
                  ? "Government API Offline"
                  : "Government API Checking"}
          </strong>
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>
          {apiStatus.detail || "Waiting for the latest API status."}
        </p>
      </div>

      {msg ? <div className="card">{msg}</div> : null}

      <section className="section">
        <div className="card">
          <div className="card-header-actions">
            <h3>Global Filters</h3>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setFilters({ from: "", to: "", country: "", provider: "", hospitalId: "" });
                setClaimsFilters({ status: "", riskMin: "", riskMax: "", patientId: "", procedure: "" });
                setAlertFilters({ status: "", severity: "" });
                setTimeout(loadAll, 0);
              }}
            >
              Reset
            </button>
          </div>
          <div className="grid info-grid">
            <label>
              <span className="muted">From</span>
              <input type="date" value={filters.from} onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))} />
            </label>
            <label>
              <span className="muted">To</span>
              <input type="date" value={filters.to} onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))} />
            </label>
            <label>
              <span className="muted">Country</span>
              <input value={filters.country} onChange={(e) => setFilters((prev) => ({ ...prev, country: e.target.value }))} placeholder="KE, UG, TZ" />
            </label>
            <label>
              <span className="muted">Health Fund</span>
              <input value={filters.provider} onChange={(e) => setFilters((prev) => ({ ...prev, provider: e.target.value }))} placeholder="SHA, NHIF" />
            </label>
            <label>
              <span className="muted">Hospital ID</span>
              <input value={filters.hospitalId} onChange={(e) => setFilters((prev) => ({ ...prev, hospitalId: e.target.value }))} placeholder="Hospital ID" />
            </label>
            <div className="profile-actions-row">
              <button type="button" className="btn-primary" onClick={loadAll} disabled={loading}>
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="grid info-grid">
          {overviewCards.map((card) => (
            <button
              key={card.label}
              type="button"
              className="card stat premium-card stat-clickable"
              onClick={card.onClick}
            >
              <strong>{card.label}</strong>
              <p>{card.value}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="section doctor-main-grid" ref={claimsSectionRef}>
        <div className="card">
          <h3>Claims Trends</h3>
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <LineChart data={trendRows}>
                <XAxis dataKey="date" hide />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="submitted" stroke="#2563eb" strokeWidth={2} />
                <Line type="monotone" dataKey="approved" stroke="#10b981" strokeWidth={2} />
                <Line type="monotone" dataKey="rejected" stroke="#ef4444" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card" ref={fraudSectionRef}>
          <h3>Fraud Severity Mix</h3>
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={fraudSeverityData} dataKey="value" nameKey="label" innerRadius={50} outerRadius={90}>
                  {fraudSeverityData.map((entry, index) => (
                    <Cell key={entry.label} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <h3>Compliance Snapshot</h3>
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={complianceData}>
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card">
          <h3>Global Risk Map</h3>
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={riskMap}>
                <XAxis dataKey="country" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="riskScore" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="table-wrap">
            <table className="table premium-table">
              <thead>
                <tr>
                  <th>Country</th>
                  <th>Total Claims</th>
                  <th>Fraud</th>
                  <th>Risk Score</th>
                </tr>
              </thead>
              <tbody>
                {riskMap.map((row) => (
                  <tr key={row.country}>
                    <td>{row.country}</td>
                    <td>{row.totalClaims}</td>
                    <td>{row.fraudCount}</td>
                    <td><span className={riskClass(row.riskScore)}>{row.riskScore}</span></td>
                  </tr>
                ))}
                {!riskMap.length ? (
                  <tr>
                    <td colSpan={4}>No risk data available.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <h3>Fraud Signals</h3>
          <div className="table-wrap">
            <table className="table premium-table">
              <thead>
                <tr>
                  <th>Signal</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                {fraudSignals.map((row) => (
                  <tr key={row.signal}>
                    <td>{row.signal}</td>
                    <td>{row.count}</td>
                  </tr>
                ))}
                {!fraudSignals.length ? (
                  <tr>
                    <td colSpan={2}>No signals captured.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <h3>Top Procedures</h3>
          <div className="table-wrap">
            <table className="table premium-table">
              <thead>
                <tr>
                  <th>Procedure</th>
                  <th>Claims</th>
                  <th>Total Amount</th>
                </tr>
              </thead>
              <tbody>
                {proceduresSummary.map((row) => (
                  <tr key={row.code}>
                    <td>{row.name || row.code}</td>
                    <td>{row.totalClaims}</td>
                    <td>{formatMoney(row.totalAmount, "KES")}</td>
                  </tr>
                ))}
                {!proceduresSummary.length ? (
                  <tr>
                    <td colSpan={3}>No procedure data.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card">
          <h3>Claims & Fraud Monitoring</h3>
          <div className="grid info-grid">
            <label>
              <span className="muted">Status</span>
              <input value={claimsFilters.status} onChange={(e) => setClaimsFilters((prev) => ({ ...prev, status: e.target.value }))} />
            </label>
            <label>
              <span className="muted">Risk Min</span>
              <input value={claimsFilters.riskMin} onChange={(e) => setClaimsFilters((prev) => ({ ...prev, riskMin: e.target.value }))} />
            </label>
            <label>
              <span className="muted">Risk Max</span>
              <input value={claimsFilters.riskMax} onChange={(e) => setClaimsFilters((prev) => ({ ...prev, riskMax: e.target.value }))} />
            </label>
            <label>
              <span className="muted">Patient ID</span>
              <input value={claimsFilters.patientId} onChange={(e) => setClaimsFilters((prev) => ({ ...prev, patientId: e.target.value }))} />
            </label>
            <label>
              <span className="muted">Procedure Code</span>
              <input value={claimsFilters.procedure} onChange={(e) => setClaimsFilters((prev) => ({ ...prev, procedure: e.target.value }))} />
            </label>
            <div className="profile-actions-row">
              <button type="button" className="btn-primary" onClick={loadClaims}>
                Apply
              </button>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table premium-table">
              <thead>
                <tr>
                  <th>Claim</th>
                  <th>Hospital</th>
                  <th>Patient</th>
                  <th>Status</th>
                  <th>Risk</th>
                  <th>Amount</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((claim) => (
                  <tr key={claim._id} className={String(claim._id) === String(highlightedClaimId) ? "query-highlight-row" : ""}>
                    <td>{claim._id}</td>
                    <td>{claim.hospital?.name || "—"}</td>
                    <td>{claim.patient ? `${claim.patient.firstName} ${claim.patient.lastName}` : "—"}</td>
                    <td>{claim.status}</td>
                    <td><span className={riskClass(claim.riskScore)}>{claim.riskScore}</span></td>
                    <td>{formatMoney(claim.totalAmount, claim.currency || "KES")}</td>
                    <td>
                      <div className="profile-actions-row">
                        <button type="button" className="btn-secondary" onClick={() => openAudit(claim._id)}>Audit</button>
                        <button type="button" className="btn-secondary" onClick={() => reviewClaim(claim._id, "APPROVE")}>Approve</button>
                        <button type="button" className="btn-secondary danger" onClick={() => reviewClaim(claim._id, "REJECT")}>Reject</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!claims.length ? (
                  <tr>
                    <td colSpan={7}>No claims found.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <h3>Suspicious Claims / Fraud Alerts</h3>
          <div className="grid info-grid">
            <label>
              <span className="muted">Status</span>
              <input value={alertFilters.status} onChange={(e) => setAlertFilters((prev) => ({ ...prev, status: e.target.value }))} />
            </label>
            <label>
              <span className="muted">Severity</span>
              <input value={alertFilters.severity} onChange={(e) => setAlertFilters((prev) => ({ ...prev, severity: e.target.value }))} />
            </label>
            <div className="profile-actions-row">
              <button type="button" className="btn-primary" onClick={loadFraudAlerts}>Apply</button>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table premium-table">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Hospital</th>
                  <th>Patient</th>
                  <th>Risk</th>
                  <th>Signals</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {fraudAlerts.map((row) => (
                  <tr key={row._id}>
                    <td>{row.severity}</td>
                    <td>{row.hospital?.name || "—"}</td>
                    <td>{row.patient ? `${row.patient.firstName} ${row.patient.lastName}` : "—"}</td>
                    <td><span className={riskClass(row.claim?.riskScore)}>{row.claim?.riskScore || 0}</span></td>
                    <td>{Array.isArray(row.signals) ? row.signals.join(", ") : "—"}</td>
                    <td>{row.status}</td>
                    <td>
                      <div className="profile-actions-row">
                        <button type="button" className="btn-secondary" onClick={() => openAudit(row.claim?._id)}>
                          View
                        </button>
                        <button type="button" className="btn-secondary" onClick={() => requestVerification(row.claim?._id)}>
                          Verify
                        </button>
                        <button type="button" className="btn-secondary" onClick={() => assignAudit(row.claim?._id)}>
                          Assign
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!fraudAlerts.length ? (
                  <tr>
                    <td colSpan={7}>No fraud alerts.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card">
          <h3>Hospital Regulation & Monitoring</h3>
          <div className="table-wrap">
            <table className="table premium-table">
              <thead>
                <tr>
                  <th>Hospital</th>
                  <th>Compliance</th>
                  <th>License</th>
                  <th>Inspection</th>
                  <th>Claims</th>
                  <th>Fraud High</th>
                </tr>
              </thead>
              <tbody>
                {hospitalMonitoring.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>
                      <span className={complianceClass(row.complianceStatus)}>{row.complianceStatus}</span>
                      <div className="muted">Score: {row.complianceScore}</div>
                    </td>
                    <td>{row.licenseStatus}</td>
                    <td>{row.inspectionStatus} ({row.inspectionScore})</td>
                    <td>{row.totalClaims}</td>
                    <td>{row.fraudHigh}</td>
                  </tr>
                ))}
                {!hospitalMonitoring.length ? (
                  <tr>
                    <td colSpan={6}>No hospital compliance data.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <h3>Schedule Inspection</h3>
          <div className="grid info-grid">
            <label>
              <span className="muted">Hospital</span>
              <select value={inspectionForm.hospitalId} onChange={(e) => setInspectionForm((prev) => ({ ...prev, hospitalId: e.target.value }))}>
                {hospitals.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="muted">Date</span>
              <input type="datetime-local" value={inspectionForm.scheduledAt} onChange={(e) => setInspectionForm((prev) => ({ ...prev, scheduledAt: e.target.value }))} />
            </label>
            <label>
              <span className="muted">Type</span>
              <select value={inspectionForm.type} onChange={(e) => setInspectionForm((prev) => ({ ...prev, type: e.target.value }))}>
                <option value="ROUTINE">Routine</option>
                <option value="ADHOC">Ad-hoc</option>
              </select>
            </label>
            <label>
              <span className="muted">Notes</span>
              <input value={inspectionForm.notes} onChange={(e) => setInspectionForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Inspection focus" />
            </label>
            <div className="profile-actions-row">
              <button type="button" className="btn-primary" onClick={createInspection}>Schedule</button>
            </div>
          </div>
          <h3>Issue Enforcement</h3>
          <div className="grid info-grid">
            <label>
              <span className="muted">Hospital</span>
              <select value={enforcementForm.hospitalId} onChange={(e) => setEnforcementForm((prev) => ({ ...prev, hospitalId: e.target.value }))}>
                {hospitals.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="muted">Action</span>
              <select value={enforcementForm.actionType} onChange={(e) => setEnforcementForm((prev) => ({ ...prev, actionType: e.target.value }))}>
                <option value="WARNING">Warning</option>
                <option value="FINE">Fine</option>
                <option value="SUSPEND_LICENSE">Suspend License</option>
                <option value="REVOKE_LICENSE">Revoke License</option>
                <option value="RESTRICT_PROCEDURE">Restrict Procedure</option>
              </select>
            </label>
            <label>
              <span className="muted">Amount</span>
              <input value={enforcementForm.amount} onChange={(e) => setEnforcementForm((prev) => ({ ...prev, amount: e.target.value }))} placeholder="0" />
            </label>
            <label>
              <span className="muted">Currency</span>
              <input value={enforcementForm.currency} onChange={(e) => setEnforcementForm((prev) => ({ ...prev, currency: e.target.value }))} />
            </label>
            <label>
              <span className="muted">Notes</span>
              <input value={enforcementForm.notes} onChange={(e) => setEnforcementForm((prev) => ({ ...prev, notes: e.target.value }))} />
            </label>
            <div className="profile-actions-row">
              <button type="button" className="btn-primary" onClick={createEnforcement}>Issue</button>
            </div>
          </div>
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card">
          <h3>Inspection Records</h3>
          <div className="table-wrap">
            <table className="table premium-table">
              <thead>
                <tr>
                  <th>Hospital</th>
                  <th>Status</th>
                  <th>Scheduled</th>
                  <th>Score</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {inspections.map((row) => (
                  <tr key={row._id}>
                    <td>{row.hospital?.name || "—"}</td>
                    <td>{row.status}</td>
                    <td>{row.scheduledAt ? new Date(row.scheduledAt).toLocaleString() : "—"}</td>
                    <td>{row.complianceScore || 0}</td>
                    <td>
                      <select value={row.status} onChange={(e) => updateInspectionStatus(row._id, e.target.value)}>
                        <option value="SCHEDULED">Scheduled</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="FAILED">Failed</option>
                        <option value="CANCELLED">Cancelled</option>
                      </select>
                    </td>
                  </tr>
                ))}
                {!inspections.length ? (
                  <tr>
                    <td colSpan={5}>No inspections recorded.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <h3>Enforcement Actions</h3>
          <div className="table-wrap">
            <table className="table premium-table">
              <thead>
                <tr>
                  <th>Hospital</th>
                  <th>Action</th>
                  <th>Status</th>
                  <th>Issued</th>
                  <th>Amount</th>
                  <th>Update</th>
                </tr>
              </thead>
              <tbody>
                {enforcements.map((row) => (
                  <tr key={row._id}>
                    <td>{row.hospital?.name || "—"}</td>
                    <td>{row.actionType}</td>
                    <td>{row.status}</td>
                    <td>{row.issuedAt ? new Date(row.issuedAt).toLocaleDateString() : "—"}</td>
                    <td>{formatMoney(row.amount || 0, row.currency || "KES")}</td>
                    <td>
                      <select value={row.status} onChange={(e) => updateEnforcementStatus(row._id, e.target.value)}>
                        <option value="OPEN">Open</option>
                        <option value="RESOLVED">Resolved</option>
                        <option value="APPEALED">Appealed</option>
                      </select>
                    </td>
                  </tr>
                ))}
                {!enforcements.length ? (
                  <tr>
                    <td colSpan={6}>No enforcement actions recorded.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card">
          <h3>Patient Oversight</h3>
          <div className="grid info-grid">
            <label>
              <span className="muted">Patient ID / National ID / Health ID</span>
              <input value={patientQuery} onChange={(e) => setPatientQuery(e.target.value)} placeholder="Enter patient identifier" />
            </label>
            <button type="button" className="btn-primary" onClick={runPatientSearch} disabled={patientLoading}>
              {patientLoading ? "Searching..." : "Search"}
            </button>
          </div>
          {patientHistory ? (
            <div className="card">
              <div className="grid info-grid">
                <div>
                  <strong>Patient</strong>
                  <p>{patientHistory?.patient ? `${patientHistory.patient.firstName} ${patientHistory.patient.lastName}` : "—"}</p>
                </div>
                <div>
                  <strong>Gender</strong>
                  <p>{patientHistory?.patient?.gender || "—"}</p>
                </div>
                <div>
                  <strong>Identity Status</strong>
                  <p>{patientHistory?.patient?.identityVerification?.status || "—"}</p>
                </div>
                <div>
                  <strong>Total Claims</strong>
                  <p>{patientHistory?.summary?.totalClaims || 0}</p>
                </div>
                <div>
                  <strong>Suspicious Alerts</strong>
                  <p>{patientHistory?.summary?.suspicious || 0}</p>
                </div>
              </div>
              <div className="table-wrap">
                <table className="table premium-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Hospital</th>
                      <th>Status</th>
                      <th>Total</th>
                      <th>Risk</th>
                      <th>Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(patientHistory?.claims || []).map((claim) => (
                      <tr key={claim.id}>
                        <td>{claim.createdAt ? new Date(claim.createdAt).toLocaleString() : "—"}</td>
                        <td>{claim?.hospital?.name || "—"}</td>
                        <td>{claim.status}</td>
                        <td>{formatMoney(claim.totalAmount, claim.currency || "KES")}</td>
                        <td><span className={riskClass(claim.riskScore)}>{claim.riskScore}</span></td>
                        <td>{Array.isArray(claim.riskFlags) ? claim.riskFlags.join(", ") : "—"}</td>
                      </tr>
                    ))}
                    {!patientHistory?.claims?.length ? (
                      <tr>
                        <td colSpan={6}>No claims for this patient.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
        <div className="card">
          <h3>Health Fund Integration</h3>
          <div className="grid info-grid">
            <label>
              <span className="muted">Code</span>
              <input value={fundForm.code} onChange={(e) => setFundForm((prev) => ({ ...prev, code: e.target.value }))} />
            </label>
            <label>
              <span className="muted">Name</span>
              <input value={fundForm.name} onChange={(e) => setFundForm((prev) => ({ ...prev, name: e.target.value }))} />
            </label>
            <label>
              <span className="muted">Country</span>
              <input value={fundForm.country} onChange={(e) => setFundForm((prev) => ({ ...prev, country: e.target.value }))} />
            </label>
            <label>
              <span className="muted">Currency</span>
              <input value={fundForm.currency} onChange={(e) => setFundForm((prev) => ({ ...prev, currency: e.target.value }))} />
            </label>
            <label>
              <span className="muted">Status</span>
              <select value={fundForm.status} onChange={(e) => setFundForm((prev) => ({ ...prev, status: e.target.value }))}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </label>
            <label>
              <span className="muted">API Status</span>
              <select value={fundForm.apiStatus} onChange={(e) => setFundForm((prev) => ({ ...prev, apiStatus: e.target.value }))}>
                <option value="CONNECTED">Connected</option>
                <option value="DEGRADED">Degraded</option>
                <option value="OFFLINE">Offline</option>
                <option value="UNKNOWN">Unknown</option>
              </select>
            </label>
            <div className="profile-actions-row">
              <button type="button" className="btn-primary" onClick={createHealthFund}>Add Fund</button>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table premium-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Country</th>
                  <th>Currency</th>
                  <th>Status</th>
                  <th>API</th>
                  <th>Update</th>
                </tr>
              </thead>
              <tbody>
                {healthFunds.map((fund) => (
                  <tr key={fund._id}>
                    <td>{fund.code}</td>
                    <td>{fund.country}</td>
                    <td>{fund.currency}</td>
                    <td>{fund.status}</td>
                    <td>{fund.apiStatus}</td>
                    <td>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() =>
                          updateHealthFund(fund._id, {
                            status: fund.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                          })
                        }
                      >
                        Toggle
                      </button>
                    </td>
                  </tr>
                ))}
                {!healthFunds.length ? (
                  <tr>
                    <td colSpan={6}>No health fund integrations.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section doctor-main-grid">
        <div className="card">
          <h3>Audit Trail & Compliance</h3>
          <div className="table-wrap">
            <table className="table premium-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Event</th>
                  <th>Role</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log, idx) => (
                  <tr key={`${log.source}-${idx}`}>
                    <td>{log.source}</td>
                    <td>{log.event}</td>
                    <td>{log.actorRole || "—"}</td>
                    <td>{log.createdAt ? new Date(log.createdAt).toLocaleString() : "—"}</td>
                  </tr>
                ))}
                {!auditLogs.length ? (
                  <tr>
                    <td colSpan={4}>No audit logs available.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <h3>Notifications & Alerts</h3>
          <div className="table-wrap">
            <table className="table premium-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Title</th>
                  <th>Message</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {notifications.map((note) => (
                  <tr key={note._id}>
                    <td>{note.category}</td>
                    <td>{note.title}</td>
                    <td>{note.body}</td>
                    <td>{note.createdAt ? new Date(note.createdAt).toLocaleString() : "—"}</td>
                  </tr>
                ))}
                {!notifications.length ? (
                  <tr>
                    <td colSpan={4}>No notifications.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section doctor-main-grid" ref={reportingSectionRef}>
        <div className="card">
          <h3>Financial & Provider Summary</h3>
          <div className="table-wrap">
            <table className="table premium-table">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Claims</th>
                  <th>Rejected</th>
                  <th>Total Amount</th>
                </tr>
              </thead>
              <tbody>
                {providerSummary.map((row) => (
                  <tr key={row.provider}>
                    <td>{row.provider}</td>
                    <td>{row.totalClaims}</td>
                    <td>{row.rejected}</td>
                    <td>{formatMoney(row.totalAmount, "KES")}</td>
                  </tr>
                ))}
                {!providerSummary.length ? (
                  <tr>
                    <td colSpan={4}>No provider summary.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="table-wrap">
            <table className="table premium-table">
              <thead>
                <tr>
                  <th>Currency</th>
                  <th>Claims</th>
                  <th>Total Amount</th>
                </tr>
              </thead>
              <tbody>
                {currencySummary.map((row) => (
                  <tr key={row.currency}>
                    <td>{row.currency}</td>
                    <td>{row.totalClaims}</td>
                    <td>{formatMoney(row.totalAmount, row.currency || "KES")}</td>
                  </tr>
                ))}
                {!currencySummary.length ? (
                  <tr>
                    <td colSpan={3}>No currency summary.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <h3>Reporting & Decision Support</h3>
          <p className="muted">Export the latest claims and compliance reports for external audits.</p>
          <div className="profile-actions-row">
            <button type="button" className="btn-secondary" onClick={() => downloadCsv("claims-report.csv", claimExportRows)}>
              Export Claims CSV
            </button>
            <button type="button" className="btn-secondary" onClick={() => downloadCsv("hospital-compliance.csv", hospitalExportRows)}>
              Export Hospital Compliance CSV
            </button>
            <button type="button" className="btn-secondary" onClick={() => window.print()}>
              Export PDF Summary
            </button>
          </div>
          <div className="grid info-grid">
            <div>
              <strong>Approved Amount</strong>
              <p>{formatMoney(overview.summary.approvedAmount, "KES")}</p>
            </div>
            <div>
              <strong>Rejected Amount</strong>
              <p>{formatMoney(overview.summary.rejectedAmount, "KES")}</p>
            </div>
            <div>
              <strong>Pending Amount</strong>
              <p>{formatMoney(overview.summary.pendingAmount, "KES")}</p>
            </div>
            <div>
              <strong>Review Amount</strong>
              <p>{formatMoney(overview.summary.reviewAmount, "KES")}</p>
            </div>
          </div>
        </div>
      </section>

      {auditOpen ? (
        <div className="drawer-backdrop" onClick={closeAudit} role="dialog" aria-modal="true">
          <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <h3>Claim Audit</h3>
                <p className="muted">Claim ID: {auditClaim}</p>
              </div>
              <button type="button" className="btn-secondary" onClick={closeAudit}>
                Close
              </button>
            </div>
            {auditLoading ? <p className="muted">Loading audit trail…</p> : null}
            <div className="drawer-content">
              <ul className="audit-log">
                {auditTrail.map((log) => (
                  <li key={log._id}>
                    <div className="audit-log-header">
                      <strong>{log.event}</strong>
                      <span>{log.createdAt ? new Date(log.createdAt).toLocaleString() : "—"}</span>
                    </div>
                    <pre>{JSON.stringify(log.payload || {}, null, 2)}</pre>
                  </li>
                ))}
                {!auditTrail.length && !auditLoading ? <li>No audit events found.</li> : null}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      <section className="section">
        <div className="card">
          <h3>Suspicious Claims Spotlight</h3>
          <div className="table-wrap">
            <table className="table premium-table">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Hospital</th>
                  <th>Patient</th>
                  <th>Risk</th>
                  <th>Signals</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {suspiciousClaims.map((row) => (
                  <tr key={row.id}>
                    <td>{row.severity}</td>
                    <td>{row.hospital?.name || "—"}</td>
                    <td>{row.patient ? `${row.patient.firstName} ${row.patient.lastName}` : "—"}</td>
                    <td><span className={riskClass(row.riskScore)}>{row.riskScore}</span></td>
                    <td>{Array.isArray(row.signals) ? row.signals.join(", ") : "—"}</td>
                    <td>{row.status}</td>
                  </tr>
                ))}
                {!suspiciousClaims.length ? (
                  <tr>
                    <td colSpan={6}>No suspicious claims in the current window.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </DashboardHomeShell>
  );
}
