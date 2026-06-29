import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ConsultationRoom from "../../components/ConsultationRoom";
import DashboardHomeShell, { DashboardSection } from "../../components/DashboardHomeShell";
import apiFetch from "../../utils/apiFetch";
import { useAuth } from "../../utils/auth";
import { useSocket } from "../../utils/socket";
import { chatAssistant } from "../../services/assistantApi";
import { updateSupportTicket } from "../../services/opsApi";
import {
  getUnifiedAssistantOverview,
  searchUnifiedAssistant,
  getUnifiedAssistantRecord,
  getUnifiedAssistantSettings,
  updateUnifiedAssistantSettings,
  logUnifiedAssistantHandoff,
  listAssistantMessages,
  sendAssistantMessage,
} from "../../services/unifiedAssistantApi";

const MODE_OPTIONS = ["ASSIST", "AUTO", "TAKEOVER"];
const AVAILABILITY_OPTIONS = ["AVAILABLE", "BUSY", "AWAY", "OFFLINE"];

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

function formatMoney(currency = "KES", amount = 0) {
  return `${currency} ${Number(amount || 0).toLocaleString()}`;
}

function patientName(patient) {
  if (!patient) return "Patient";
  const full = [patient.firstName, patient.lastName].filter(Boolean).join(" ").trim();
  return full || patient.name || patient.nationalId || patient.countryId || "Patient";
}

function userName(user) {
  if (!user) return "User";
  return user.name || user.email || user.phone || user.role || "User";
}

function badgeClass(value = "") {
  const t = String(value || "").toUpperCase();
  if (["CRITICAL", "HIGH", "ESCALATED", "REJECTED", "TERMINATED", "VOID"].includes(t)) return "risk";
  if (["MEDIUM", "REVIEW_REQUIRED", "SUBMITTED", "ASSIGNED", "REQUESTED", "UNPAID", "PAST_DUE"].includes(t)) return "warn";
  return "good";
}

function formatModeLabel(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/(^|_)([a-z])/g, (_, prefix, chr) => `${prefix ? " " : ""}${chr.toUpperCase()}`)
    .trim();
}

function formatAvailabilityLabel(value = "") {
  return formatModeLabel(value);
}

function scalarText(value) {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value instanceof Date) return formatDate(value);
  if (Array.isArray(value)) {
    const rendered = value.map((item) => scalarText(item)).filter((item) => item && item !== "—");
    return rendered.length ? rendered.join(", ") : "—";
  }
  if (typeof value === "object") {
    const entries = Object.entries(value)
      .map(([key, item]) => `${key}: ${scalarText(item)}`)
      .filter((item) => item && !item.endsWith(": —"));
    return entries.length ? entries.join(" • ") : "—";
  }
  return String(value);
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function buildSelectionRecord(selection, recordData) {
  if (!selection) return null;
  if (selection.type === "record") return recordData?.record || null;
  if (selection.type === "ticket") return recordData?.record || selection.item || null;
  if (selection.type === "call") return recordData?.record || selection.item || null;
  if (selection.type === "alert") return recordData?.record || selection.item || null;
  return selection.item || null;
}

function currentEntityContext(selection, recordData) {
  if (!selection) return { kind: "", id: "" };
  if (selection.type === "record") {
    return {
      kind: selection.item?.kind || recordData?.kind || "",
      id: selection.item?.id || recordData?.record?._id || "",
    };
  }
  if (selection.type === "ticket") return { kind: "ticket", id: recordData?.record?._id || selection.item?._id || "" };
  if (selection.type === "call") return { kind: "call", id: recordData?.record?._id || selection.item?._id || "" };
  if (selection.type === "alert") {
    return {
      kind: selection.item?.entityKind || "alert",
      id: selection.item?.entityId || selection.item?.id || "",
    };
  }
  if (selection.type === "channel") return { kind: "channel", id: selection.item?._id || "" };
  return { kind: "", id: "" };
}

function buildAiPrompt(selection, recordData, workspaceSettings) {
  const record = buildSelectionRecord(selection, recordData);
  const label = selection?.type === "channel"
    ? `communication channel ${selection.item?.name || "channel"}`
    : selection?.type === "ticket"
      ? `support ticket ${record?.ticketKey || record?.title || "ticket"}`
      : selection?.type === "call"
        ? `call session ${record?._id || "call"}`
        : selection?.type === "alert"
          ? `alert ${selection.item?.title || "alert"}`
          : `${selection?.item?.kind || "record"} ${record?._id || ""}`;

  return [
    "You are the AfyaLink Unified Assistant copilot.",
    "Draft a concise support response and next action plan.",
    "Return plain text only.",
    `Current workspace item: ${label}.`,
    `Workspace mode: ${workspaceSettings?.operatingMode || "ASSIST"}.`,
    `Human availability: ${workspaceSettings?.humanAvailability?.status || "AVAILABLE"}.`,
    `Context JSON: ${JSON.stringify({ selection, record: recordData }, null, 2)}`,
  ].join("\n");
}

function buildRouteWithParams(path, params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === "") return;
    qs.set(key, String(value));
  });
  const query = qs.toString();
  return query ? `${path}?${query}` : path;
}

function resolveUnifiedRecordPath(kind, record) {
  const entityKind = String(kind || "").toLowerCase();
  if (!record) return "";
  switch (entityKind) {
    case "patient": {
      const lookup = record?.nationalId || record?.countryId || patientName(record);
      return buildRouteWithParams("/app/governance/registry/patient-identity", {
        q: lookup,
        highlight: lookup,
      });
    }
    case "hospital": {
      const lookup = record?.verification?.registrationNumber || record?.code || record?.name;
      return buildRouteWithParams("/app/governance/registry/hospitals", {
        q: lookup,
        highlight: lookup,
      });
    }
    case "claim":
      return buildRouteWithParams("/app/governance/claims/index", {
        claimId: record?._id,
        hospitalId: record?.hospital?._id || record?.hospitalSnapshot?._id || "",
        patientId: record?.patient?.nationalId || record?.patientSnapshot?.nationalId || "",
      });
    case "ticket":
      return buildRouteWithParams("/app/platform/support/tickets", {
        ticketId: record?._id,
        q: record?.ticketKey || record?.title || "",
      });
    case "call":
      return buildRouteWithParams("/app/operations/consultations/monitor", {
        callId: record?._id,
        status: record?.status || "",
      });
    case "user":
      return buildRouteWithParams("/app/platform/security/access-control", {
        userId: record?._id,
        q: record?.email || record?.name || record?.phone || "",
      });
    case "audit":
      return buildRouteWithParams("/app/platform/dev/home", {
        auditId: record?._id,
        resource: record?.resource || "",
      });
    case "invoice":
      return buildRouteWithParams("/app/revenue/financials/index", {
        invoiceId: record?._id,
        q: record?.invoiceNumber || record?.patient?.email || record?.patient?.name || "",
      });
    default:
      return "";
  }
}

function isInteractiveTarget(target) {
  return Boolean(target?.closest?.("button, a, input, select, textarea, label"));
}

function DetailCard({ title, subtitle, actions, children, className = "", onOpen }) {
  const clickable = typeof onOpen === "function";
  return (
    <div
      className={`assistant-detail-card${clickable ? " clickable" : ""} ${className}`.trim()}
      onClick={(event) => {
        if (!clickable) return;
        if (isInteractiveTarget(event.target)) return;
        onOpen();
      }}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={(event) => {
        if (!clickable || event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="assistant-detail-card-header">
        <div>
          <h4>{title}</h4>
          {subtitle ? <div className="muted">{subtitle}</div> : null}
        </div>
        {actions ? <div className="assistant-badge-row">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

function MetricChip({ label, value, onClick }) {
  const clickable = typeof onClick === "function";
  const content = (
    <>
      <strong>{value}</strong>
      <span>{label}</span>
    </>
  );
  if (!clickable) return <div className="assistant-metric-chip">{content}</div>;
  return (
    <button type="button" className="assistant-metric-chip assistant-metric-chip-button" onClick={onClick}>
      {content}
    </button>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="assistant-detail-row">
      <span className="assistant-detail-label">{label}</span>
      <span className="assistant-detail-value">{scalarText(value)}</span>
    </div>
  );
}

function TagList({ items = [], tone = "subtle" }) {
  const rows = safeArray(items).filter(Boolean);
  if (!rows.length) return null;
  return (
    <div className="assistant-badge-row assistant-badge-row-left">
      {rows.map((item) => (
        <span key={`${tone}-${item}`} className={`assistant-badge ${tone}`}>
          {item}
        </span>
      ))}
    </div>
  );
}

function KeyValueList({ data }) {
  const entries = Object.entries(data || {}).filter(([, value]) => {
    if (value == null || value === "") return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object") return Object.keys(value).length > 0;
    return true;
  });
  if (!entries.length) return <div className="muted">No structured data available.</div>;
  return (
    <div className="assistant-keyvalue-list">
      {entries.map(([key, value]) => (
        <DetailRow key={key} label={formatModeLabel(key)} value={value} />
      ))}
    </div>
  );
}

function ActionList({ items = [], empty = "Nothing available.", onOpen, labelResolver, metaResolver }) {
  const rows = safeArray(items);
  if (!rows.length) return <div className="muted">{empty}</div>;
  return (
    <div className="assistant-list compact">
      {rows.map((item) => (
        <button
          type="button"
          key={item._id || item.id || `${item.ticketKey || item.status}-${item.createdAt || item.updatedAt || Math.random()}`}
          className="assistant-mini-action"
          onClick={onOpen ? () => onOpen(item) : undefined}
        >
          <div>
            <strong>{labelResolver ? labelResolver(item) : item.title || item.ticketKey || item.status}</strong>
            <div className="muted">{metaResolver ? metaResolver(item) : formatDate(item.createdAt || item.updatedAt)}</div>
          </div>
          {item.status || item.priority ? (
            <span className={`assistant-badge ${badgeClass(item.priority || item.status)}`}>{item.priority || item.status}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

function PatientRecordView({ record, related, onOpenRecord, onNavigateRecord }) {
  const claims = safeArray(related?.claims);
  const calls = safeArray(related?.calls);
  const appointments = safeArray(related?.appointments);
  return (
    <div className="assistant-record-panel">
      <div className="assistant-detail-grid two-col">
        <DetailCard title={patientName(record)} subtitle={record?.hospital?.name || "Patient profile"} actions={(
          <>
            <span className={`assistant-badge ${badgeClass(record?.identityVerification?.status)}`}>{record?.identityVerification?.status || "UNVERIFIED"}</span>
            {record?.gender ? <span className="assistant-badge subtle">{record.gender}</span> : null}
          </>
        )} onOpen={() => onNavigateRecord?.("patient", record)}>
          <DetailRow label="National ID" value={record?.nationalId} />
          <DetailRow label="Health ID" value={record?.countryId} />
          <DetailRow label="Date of Birth" value={record?.dob ? new Date(record.dob).toLocaleDateString() : "—"} />
          <DetailRow label="Phone" value={record?.contact} />
          <DetailRow label="Address" value={record?.address} />
          <DetailRow label="Primary Doctor" value={record?.primaryDoctor?.name || record?.primaryDoctor?.email} />
        </DetailCard>
        <DetailCard title="Verification & Insurance" subtitle="Identity, registry match, and payer context" onOpen={() => onNavigateRecord?.("patient", record)}>
          <DetailRow label="Verification Method" value={record?.identityVerification?.method} />
          <DetailRow label="Registry Match" value={record?.identityVerification?.registryMatch} />
          <DetailRow label="Last Checked" value={formatDate(record?.identityVerification?.lastCheckedAt)} />
          <DetailRow label="Insurance Provider" value={record?.insurance?.provider} />
          <DetailRow label="Policy Number" value={record?.insurance?.policyNumber} />
        </DetailCard>
      </div>

      <DetailCard title="Claims History" subtitle="Recent claims and risk state">
        <ActionList
          items={claims}
          empty="No claims linked to this patient yet."
          onOpen={(item) => onOpenRecord?.("claim", item._id)}
          labelResolver={(item) => `${item.status} • ${formatMoney(item.currency, item.totalAmount)}`}
          metaResolver={(item) => `Risk ${Math.round(item.riskScore || 0)} • ${formatDate(item.createdAt)}`}
        />
      </DetailCard>

      <div className="assistant-detail-grid two-col">
        <DetailCard title="Recent Appointments">
          <ActionList
            items={appointments}
            empty="No recent appointments."
            labelResolver={(item) => item.serviceType || item.status || "Appointment"}
            metaResolver={(item) => `${formatDate(item.scheduledAt)} • ${item.doctor?.name || "Unassigned doctor"}`}
          />
        </DetailCard>
        <DetailCard title="Consultation Calls">
          <ActionList
            items={calls}
            empty="No consultation calls."
            onOpen={(item) => onOpenRecord?.("call", item._id)}
            labelResolver={(item) => `${item.callType || "Call"} • ${item.status}`}
            metaResolver={(item) => `${item.doctor?.name || "Doctor"} • ${formatDate(item.createdAt)}`}
          />
        </DetailCard>
      </div>
    </div>
  );
}

function HospitalRecordView({ record, related, onOpenRecord, onNavigateRecord }) {
  const claimSummary = safeArray(related?.claimSummary);
  const tickets = safeArray(related?.tickets);
  const calls = safeArray(related?.calls);
  return (
    <div className="assistant-record-panel">
      <div className="assistant-detail-grid two-col">
        <DetailCard title={record?.name || "Hospital"} subtitle={record?.code || "Hospital profile"} actions={(
          <>
            <span className={`assistant-badge ${badgeClass(record?.verification?.status)}`}>{record?.verification?.status || "UNVERIFIED"}</span>
            {record?.type ? <span className="assistant-badge subtle">{record.type}</span> : null}
          </>
        )} onOpen={() => onNavigateRecord?.("hospital", record)}>
          <DetailRow label="Registration" value={record?.verification?.registrationNumber} />
          <DetailRow label="Contact" value={record?.contact} />
          <DetailRow label="Address" value={record?.address} />
          <DetailRow label="Country" value={record?.location?.country} />
          <DetailRow label="Region" value={record?.location?.region} />
          <DetailRow label="City" value={record?.location?.city} />
        </DetailCard>
        <DetailCard title="Compliance & Capacity" subtitle="Verification, plan, staff, and patients" onOpen={() => onNavigateRecord?.("hospital", record)}>
          <DetailRow label="Plan" value={record?.plan} />
          <DetailRow label="Feature Flags" value={Object.entries(record?.features || {}).filter(([, enabled]) => enabled).map(([key]) => formatModeLabel(key))} />
          <DetailRow label="Insurance Providers" value={safeArray(record?.insuranceProviders).map((item) => item.name || item.code)} />
          <DetailRow label="Staff Count" value={related?.staffCount ?? "—"} />
          <DetailRow label="Patient Count" value={related?.patientCount ?? "—"} />
        </DetailCard>
      </div>

      <DetailCard title="Claims Summary" subtitle="Status totals for this hospital" onOpen={() => onNavigateRecord?.("hospital", record)}>
        {claimSummary.length ? (
          <div className="assistant-keyvalue-list">
            {claimSummary.map((row) => (
              <DetailRow key={row._id || "unknown"} label={row._id || "UNKNOWN"} value={`${row.count} claims • ${formatMoney("KES", row.totalAmount)}`} />
            ))}
          </div>
        ) : (
          <div className="muted">No claim activity yet.</div>
        )}
      </DetailCard>

      <div className="assistant-detail-grid two-col">
        <DetailCard title="Support Tickets">
          <ActionList
            items={tickets}
            empty="No recent support tickets."
            onOpen={(item) => onOpenRecord?.("ticket", item._id)}
            labelResolver={(item) => `${item.ticketKey || "Ticket"} • ${item.title}`}
            metaResolver={(item) => `${item.priority || "MEDIUM"} • ${formatDate(item.updatedAt)}`}
          />
        </DetailCard>
        <DetailCard title="Call Sessions">
          <ActionList
            items={calls}
            empty="No recent calls."
            onOpen={(item) => onOpenRecord?.("call", item._id)}
            labelResolver={(item) => `${item.callType || "Call"} • ${patientName(item.patient)}`}
            metaResolver={(item) => `${item.doctor?.name || "Doctor"} • ${formatDate(item.createdAt)}`}
          />
        </DetailCard>
      </div>
    </div>
  );
}

function ClaimRecordView({ record, related, onOpenRecord, onNavigateRecord }) {
  const audit = safeArray(related?.audit);
  const procedures = safeArray(record?.procedures);
  const riskSignals = safeArray(record?.riskSignals);
  return (
    <div className="assistant-record-panel">
      <div className="assistant-detail-grid two-col">
        <DetailCard title="Claim Overview" subtitle={record?.hospital?.name || record?.hospitalSnapshot?.name || "Hospital claim"} actions={(
          <>
            <span className={`assistant-badge ${badgeClass(record?.status)}`}>{record?.status || "SUBMITTED"}</span>
            <span className={`assistant-badge ${badgeClass(record?.riskScore >= 85 ? "HIGH" : record?.riskScore >= 65 ? "MEDIUM" : "LOW")}`}>
              Risk {Math.round(record?.riskScore || 0)}
            </span>
          </>
        )} onOpen={() => onNavigateRecord?.("claim", record)}>
          <DetailRow label="Patient" value={patientName(record?.patient) || record?.patientSnapshot?.nationalId} />
          <DetailRow label="Provider" value={record?.provider?.name || record?.provider?.code} />
          <DetailRow label="Amount" value={formatMoney(record?.currency, record?.totalAmount)} />
          <DetailRow label="Service Period" value={`${formatDate(record?.servicePeriod?.start)} → ${formatDate(record?.servicePeriod?.end)}`} />
          <DetailRow label="Submitted By" value={record?.submittedBy?.name || record?.submittedBy?.email} />
          <DetailRow label="Decision" value={record?.decision?.notes || record?.decision?.reviewedBy?.name || "Pending"} />
        </DetailCard>
        <DetailCard title="Fraud & Signature" subtitle="Flags, signals, and integrity proof" onOpen={() => onNavigateRecord?.("claim", record)}>
          <DetailRow label="Duplicate Group" value={record?.duplicateGroup} />
          <DetailRow label="Duplicate Of" value={record?.duplicateOf} />
          <DetailRow label="Risk Flags" value={record?.riskFlags} />
          <DetailRow label="Signature Algorithm" value={record?.signature?.algorithm} />
          <DetailRow label="Key ID" value={record?.signature?.keyId} />
          <DetailRow label="Signed At" value={formatDate(record?.signature?.signedAt)} />
          <TagList items={riskSignals.map((item) => `${item.code || item.severity}: ${item.message || "Signal"}`)} tone="warn" />
        </DetailCard>
      </div>

      <DetailCard title="Procedures" subtitle="Submitted procedure rows and timing" onOpen={() => onNavigateRecord?.("claim", record)}>
        {procedures.length ? (
          <div className="assistant-keyvalue-list">
            {procedures.map((item, index) => (
              <DetailRow
                key={`${item.code || item.name || "procedure"}-${index}`}
                label={item.code || item.name || `Procedure ${index + 1}`}
                value={`${item.name || item.category || "Procedure"} • Qty ${item.quantity || 1} • ${formatMoney(record?.currency, item.amount || 0)} • ${formatDate(item.performedAt)}`}
              />
            ))}
          </div>
        ) : (
          <div className="muted">No procedures recorded.</div>
        )}
      </DetailCard>

      <DetailCard title="Audit Trail" subtitle="Recent claim audit entries" actions={(
        <>
          {record?.patient?._id ? (
            <button type="button" className="btn-secondary" onClick={() => onOpenRecord?.("patient", record.patient._id)}>Open Patient</button>
          ) : null}
          {record?.hospital?._id ? (
            <button type="button" className="btn-secondary" onClick={() => onOpenRecord?.("hospital", record.hospital._id)}>Open Hospital</button>
          ) : null}
        </>
      )} onOpen={() => onNavigateRecord?.("claim", record)}>
        {audit.length ? (
          <div className="assistant-timeline">
            {audit.map((item) => (
              <div key={item._id} className="assistant-timeline-item">
                <strong>{item.action}</strong>
                <div className="muted">{formatDate(item.createdAt)} • {item.actorRole || "SYSTEM"}</div>
                <div>{item.error || scalarText(item.metadata) || "No extra detail"}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="muted">No audit entries linked yet.</div>
        )}
      </DetailCard>
    </div>
  );
}

function TicketRecordView({ record, onOpenRecord, onNavigateRecord }) {
  const events = safeArray(record?.events);
  return (
    <div className="assistant-record-panel">
      <div className="assistant-detail-grid two-col">
        <DetailCard title={record?.title || "Support Ticket"} subtitle={record?.ticketKey || "Ticket"} actions={(
          <>
            <span className={`assistant-badge ${badgeClass(record?.priority)}`}>{record?.priority || "MEDIUM"}</span>
            <span className={`assistant-badge ${badgeClass(record?.status)}`}>{record?.status || "OPEN"}</span>
          </>
        )} onOpen={() => onNavigateRecord?.("ticket", record)}>
          <div className="muted">{record?.description || "No description provided."}</div>
          <DetailRow label="Category" value={record?.category} />
          <DetailRow label="Hospital" value={record?.hospital?.name || "Platform"} />
          <DetailRow label="Requester" value={record?.requester?.name || record?.requester?.email} />
          <DetailRow label="Assignee" value={record?.assignee?.name || record?.assignee?.email} />
        </DetailCard>
        <DetailCard title="Linked Incident & Timing" onOpen={() => onNavigateRecord?.("ticket", record)}>
          <DetailRow label="Linked Incident" value={record?.linkedIncident?.incidentKey || record?.linkedIncident?.summary} />
          <DetailRow label="Created" value={formatDate(record?.createdAt)} />
          <DetailRow label="Updated" value={formatDate(record?.updatedAt)} />
          <DetailRow label="Resolved" value={formatDate(record?.resolvedAt)} />
          {record?.hospital?._id ? (
            <div className="assistant-inline-actions">
              <button type="button" className="btn-secondary" onClick={() => onOpenRecord?.("hospital", record.hospital._id)}>
                Open Hospital
              </button>
            </div>
          ) : null}
        </DetailCard>
      </div>

      <DetailCard title="Ticket Activity" onOpen={() => onNavigateRecord?.("ticket", record)}>
        {events.length ? (
          <div className="assistant-timeline">
            {events.map((event, index) => (
              <div key={`${event.type}-${event.at || index}`} className="assistant-timeline-item">
                <strong>{event.type}</strong>
                <div className="muted">{event.actor?.name || "User"} • {formatDate(event.at)}</div>
                {event.note ? <div>{event.note}</div> : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="muted">No events recorded.</div>
        )}
      </DetailCard>
    </div>
  );
}

function CallRecordView({ record, onOpenRecord, onNavigateRecord }) {
  return (
    <div className="assistant-record-panel">
      <div className="assistant-detail-grid two-col">
        <DetailCard title="Call Context" subtitle={record?.hospital?.name || "Consultation call"} actions={(
          <>
            <span className={`assistant-badge ${badgeClass(record?.status)}`}>{record?.status || "REQUESTED"}</span>
            <span className="assistant-badge subtle">{record?.callType || "VOICE"}</span>
          </>
        )} onOpen={() => onNavigateRecord?.("call", record)}>
          <DetailRow label="Patient" value={patientName(record?.patient)} />
          <DetailRow label="Patient ID" value={record?.patient?.nationalId} />
          <DetailRow label="Doctor" value={record?.doctor?.name || record?.doctor?.email} />
          <DetailRow label="Started" value={formatDate(record?.startedAt)} />
          <DetailRow label="Ended" value={formatDate(record?.endedAt)} />
          <DetailRow label="Blocked" value={record?.isBlocked} />
        </DetailCard>
        <DetailCard title="Appointment Context" onOpen={() => onNavigateRecord?.("call", record)}>
          <DetailRow label="Service" value={record?.appointment?.serviceType} />
          <DetailRow label="Scheduled" value={formatDate(record?.appointment?.scheduledAt)} />
          <DetailRow label="Visit Status" value={record?.appointment?.status} />
          <DetailRow label="Notes" value={record?.appointment?.notes} />
          <DetailRow label="Summary" value={record?.appointment?.metadata?.consultationSummary} />
          <div className="assistant-inline-actions">
            {record?.patient?._id ? (
              <button type="button" className="btn-secondary" onClick={() => onOpenRecord?.("patient", record.patient._id)}>
                Open Patient
              </button>
            ) : null}
          </div>
        </DetailCard>
      </div>
    </div>
  );
}

function UserRecordView({ record, related, onOpenRecord, onNavigateRecord }) {
  const tickets = safeArray(related?.tickets);
  const calls = safeArray(related?.calls);
  return (
    <div className="assistant-record-panel">
      <div className="assistant-detail-grid two-col">
        <DetailCard title={userName(record)} subtitle={record?.role || "User"} onOpen={() => onNavigateRecord?.("user", record)}>
          <DetailRow label="Email" value={record?.email} />
          <DetailRow label="Phone" value={record?.phone} />
          <DetailRow label="National ID" value={record?.nationalIdNumber} />
          <DetailRow label="Hospital" value={record?.hospital?.name || "Platform"} />
          <DetailRow label="Employment" value={record?.employment} />
        </DetailCard>
        <DetailCard title="Assignments" onOpen={() => onNavigateRecord?.("user", record)}>
          <DetailRow label="Open Tickets" value={tickets.length} />
          <DetailRow label="Call Sessions" value={calls.length} />
        </DetailCard>
      </div>
      <div className="assistant-detail-grid two-col">
        <DetailCard title="Related Tickets">
          <ActionList
            items={tickets}
            empty="No related tickets."
            onOpen={(item) => onOpenRecord?.("ticket", item._id)}
            labelResolver={(item) => `${item.ticketKey || "Ticket"} • ${item.title}`}
            metaResolver={(item) => `${item.status} • ${formatDate(item.updatedAt)}`}
          />
        </DetailCard>
        <DetailCard title="Related Calls">
          <ActionList
            items={calls}
            empty="No related calls."
            onOpen={(item) => onOpenRecord?.("call", item._id)}
            labelResolver={(item) => `${item.callType || "Call"} • ${patientName(item.patient)}`}
            metaResolver={(item) => `${item.status} • ${formatDate(item.createdAt)}`}
          />
        </DetailCard>
      </div>
    </div>
  );
}

function AuditRecordView({ record, onNavigateRecord }) {
  return (
    <div className="assistant-record-panel">
      <div className="assistant-detail-grid two-col">
        <DetailCard title={record?.action || "Audit Event"} subtitle={record?.resource || "Audit log"} actions={(
          <span className={`assistant-badge ${record?.success === false ? "risk" : "good"}`}>
            {record?.success === false ? "Failed" : "Success"}
          </span>
        )} onOpen={() => onNavigateRecord?.("audit", record)}>
          <DetailRow label="Actor" value={record?.actorId?.name || record?.actorId?.email || record?.actorRole} />
          <DetailRow label="Role" value={record?.actorRole} />
          <DetailRow label="When" value={formatDate(record?.createdAt)} />
          <DetailRow label="Resource ID" value={record?.resourceId} />
          <DetailRow label="Error" value={record?.error} />
        </DetailCard>
        <DetailCard title="Metadata" onOpen={() => onNavigateRecord?.("audit", record)}>
          <KeyValueList data={record?.metadata} />
        </DetailCard>
      </div>
      <div className="assistant-detail-grid two-col">
        <DetailCard title="Before" onOpen={() => onNavigateRecord?.("audit", record)}>
          <KeyValueList data={record?.before} />
        </DetailCard>
        <DetailCard title="After" onOpen={() => onNavigateRecord?.("audit", record)}>
          <KeyValueList data={record?.after} />
        </DetailCard>
      </div>
    </div>
  );
}

function InvoiceRecordView({ record, onOpenRecord, onNavigateRecord }) {
  return (
    <div className="assistant-record-panel">
      <div className="assistant-detail-grid two-col">
        <DetailCard title={record?.invoiceNumber || "Invoice"} subtitle={record?.hospital?.name || "Hospital invoice"} actions={(
          <span className={`assistant-badge ${badgeClass(record?.status)}`}>{record?.status || "UNPAID"}</span>
        )} onOpen={() => onNavigateRecord?.("invoice", record)}>
          <DetailRow label="Amount" value={formatMoney(record?.currency, record?.total || record?.amount || 0)} />
          <DetailRow label="Patient" value={record?.patient?.name || record?.patient?.email} />
          <DetailRow label="Phone" value={record?.patient?.phone} />
          <DetailRow label="Created" value={formatDate(record?.createdAt)} />
          <DetailRow label="Metadata" value={record?.metadata} />
        </DetailCard>
        <DetailCard title="Quick Actions" onOpen={() => onNavigateRecord?.("invoice", record)}>
          {record?.hospital?._id ? (
            <button type="button" className="btn-secondary" onClick={() => onOpenRecord?.("hospital", record.hospital._id)}>
              Open Hospital
            </button>
          ) : null}
        </DetailCard>
      </div>
    </div>
  );
}

function StructuredRecordRenderer({ kind, record, related, onOpenRecord, onNavigateRecord }) {
  switch (String(kind || "").toLowerCase()) {
    case "patient":
      return <PatientRecordView record={record} related={related} onOpenRecord={onOpenRecord} onNavigateRecord={onNavigateRecord} />;
    case "hospital":
      return <HospitalRecordView record={record} related={related} onOpenRecord={onOpenRecord} onNavigateRecord={onNavigateRecord} />;
    case "claim":
      return <ClaimRecordView record={record} related={related} onOpenRecord={onOpenRecord} onNavigateRecord={onNavigateRecord} />;
    case "ticket":
      return <TicketRecordView record={record} onOpenRecord={onOpenRecord} onNavigateRecord={onNavigateRecord} />;
    case "call":
      return <CallRecordView record={record} onOpenRecord={onOpenRecord} onNavigateRecord={onNavigateRecord} />;
    case "user":
      return <UserRecordView record={record} related={related} onOpenRecord={onOpenRecord} onNavigateRecord={onNavigateRecord} />;
    case "audit":
      return <AuditRecordView record={record} onNavigateRecord={onNavigateRecord} />;
    case "invoice":
      return <InvoiceRecordView record={record} onOpenRecord={onOpenRecord} onNavigateRecord={onNavigateRecord} />;
    default:
      return (
        <DetailCard title="Record Details" subtitle="Structured view unavailable">
          <KeyValueList data={record} />
        </DetailCard>
      );
  }
}

function SidebarContext({ selection, recordData, overview, onOpenRecord, onNavigateRecord, onNavigatePath }) {
  const record = recordData?.record;
  const related = recordData?.related || {};

  if (!selection || !record) {
    return (
      <div className="assistant-right-stack">
        <DetailCard title="Financial Overview" onOpen={() => onNavigatePath?.("/app/revenue/financials/index")}>
          {Object.entries(overview?.financialSummary?.claims || {}).slice(0, 4).map(([status, row]) => (
            <div key={status} className="assistant-mini-row">
              <span>{status}</span>
              <span>{formatMoney("KES", row?.totalAmount)}</span>
            </div>
          ))}
          {!Object.keys(overview?.financialSummary?.claims || {}).length ? <div className="muted">No claim totals available.</div> : null}
        </DetailCard>

        <DetailCard title="System Logs" onOpen={() => onNavigatePath?.("/app/platform/dev/home")}>
          {(overview?.developerSignals || []).map((signal) => (
            <button
              type="button"
              key={signal._id}
              className="assistant-log-row assistant-log-row-button"
              onClick={() => onNavigatePath?.(buildRouteWithParams("/app/platform/dev/home", { auditId: signal._id, resource: signal.resource }))}
            >
              <strong>{signal.action}</strong>
              <div className="muted">{signal.error || signal.resource || "No error detail"}</div>
              <div className="muted">{signal.actorRole} • {formatDate(signal.createdAt)}</div>
            </button>
          ))}
          {!overview?.developerSignals?.length ? <div className="muted">No recent system errors.</div> : null}
        </DetailCard>

        <DetailCard title="Hospital Watchlist" onOpen={() => onNavigatePath?.("/app/governance/registry/hospitals")}>
          {(overview?.hospitalWatchlist || []).map((hospital) => (
            <button
              type="button"
              key={hospital._id}
              className="assistant-mini-action"
              onClick={() => onNavigateRecord?.("hospital", hospital)}
            >
              <span>{hospital.name || hospital.code || "Hospital"}</span>
              <span>{hospital.fraudAlerts} fraud / {hospital.pendingClaims} pending</span>
            </button>
          ))}
          {!overview?.hospitalWatchlist?.length ? <div className="muted">No watchlist hospitals in scope.</div> : null}
        </DetailCard>
      </div>
    );
  }

  if (selection.type === "ticket") {
    return (
      <div className="assistant-right-stack">
        <DetailCard title="Requester Context" onOpen={() => onNavigateRecord?.("ticket", record)}>
          <DetailRow label="Requester" value={record?.requester?.name || record?.requester?.email} />
          <DetailRow label="Role" value={record?.requester?.role} />
          <DetailRow label="Hospital" value={record?.hospital?.name || "Platform"} />
        </DetailCard>
        <DetailCard title="Linked Incident" onOpen={() => onNavigateRecord?.("ticket", record)}>
          <DetailRow label="Incident" value={record?.linkedIncident?.incidentKey || record?.linkedIncident?.summary} />
          <DetailRow label="Severity" value={record?.linkedIncident?.severity} />
          <DetailRow label="Status" value={record?.linkedIncident?.status} />
        </DetailCard>
      </div>
    );
  }

  if (selection.type === "call") {
    return (
      <div className="assistant-right-stack">
        <DetailCard title="Patient Snapshot" onOpen={() => onNavigateRecord?.("call", record)}>
          <DetailRow label="Patient" value={patientName(record?.patient)} />
          <DetailRow label="Patient ID" value={record?.patient?.nationalId} />
          <DetailRow label="Doctor" value={record?.doctor?.name || record?.doctor?.email} />
          <DetailRow label="Service" value={record?.appointment?.serviceType} />
        </DetailCard>
        <DetailCard title="Visit Summary" onOpen={() => onNavigateRecord?.("call", record)}>
          <DetailRow label="Visit Status" value={record?.appointment?.status} />
          <DetailRow label="Notes" value={record?.appointment?.notes} />
          <DetailRow label="Summary" value={record?.appointment?.metadata?.consultationSummary} />
        </DetailCard>
      </div>
    );
  }

  if (recordData?.kind === "claim") {
    return (
      <div className="assistant-right-stack">
        <DetailCard title="Risk Snapshot" onOpen={() => onNavigateRecord?.("claim", record)}>
          <DetailRow label="Risk Score" value={Math.round(record?.riskScore || 0)} />
          <DetailRow label="Flags" value={record?.riskFlags} />
          <DetailRow label="Signals" value={safeArray(record?.riskSignals).map((item) => `${item.code}: ${item.message}`)} />
        </DetailCard>
        <DetailCard title="Decision Context" onOpen={() => onNavigateRecord?.("claim", record)}>
          <DetailRow label="Reviewed By" value={record?.decision?.reviewedBy?.name || "Pending"} />
          <DetailRow label="Reviewed At" value={formatDate(record?.decision?.reviewedAt)} />
          <DetailRow label="Decision Notes" value={record?.decision?.notes} />
        </DetailCard>
      </div>
    );
  }

  if (recordData?.kind === "patient") {
    return (
      <div className="assistant-right-stack">
        <DetailCard title="Recent Claims" onOpen={() => onNavigateRecord?.("patient", record)}>
          <ActionList
            items={safeArray(related?.claims).slice(0, 4)}
            empty="No recent claims."
            onOpen={(item) => onOpenRecord?.("claim", item._id)}
            labelResolver={(item) => `${item.status} • ${formatMoney(item.currency, item.totalAmount)}`}
            metaResolver={(item) => `Risk ${Math.round(item.riskScore || 0)} • ${formatDate(item.createdAt)}`}
          />
        </DetailCard>
        <DetailCard title="Upcoming / Recent Appointments" onOpen={() => onNavigateRecord?.("patient", record)}>
          <ActionList
            items={safeArray(related?.appointments).slice(0, 4)}
            empty="No appointments."
            labelResolver={(item) => item.serviceType || item.status}
            metaResolver={(item) => `${formatDate(item.scheduledAt)} • ${item.doctor?.name || "Unassigned"}`}
          />
        </DetailCard>
      </div>
    );
  }

  return (
    <div className="assistant-right-stack">
      {(related?.claims || related?.claimSummary) ? (
        <DetailCard title="Claims / Financial" onOpen={() => onNavigatePath?.("/app/revenue/financials/index")}>
          {safeArray(related?.claims).map((claim) => (
            <div key={claim._id} className="assistant-mini-row">
              <span>{claim.status}</span>
              <span>{formatMoney(claim.currency, claim.totalAmount)}</span>
            </div>
          ))}
          {safeArray(related?.claimSummary).map((row) => (
            <div key={row._id || "unknown"} className="assistant-mini-row">
              <span>{row._id || "UNKNOWN"}</span>
              <span>{formatMoney("KES", row.totalAmount)}</span>
            </div>
          ))}
        </DetailCard>
      ) : null}

      {(related?.calls || related?.appointments || related?.tickets) ? (
        <DetailCard title="Related Activity">
          {safeArray(related?.calls).slice(0, 5).map((item) => (
            <div key={item._id} className="assistant-mini-row">
              <span>{item.callType || item.status}</span>
              <span>{formatDate(item.createdAt || item.scheduledAt)}</span>
            </div>
          ))}
          {safeArray(related?.appointments).slice(0, 5).map((item) => (
            <div key={item._id} className="assistant-mini-row">
              <span>{item.serviceType || item.status}</span>
              <span>{formatDate(item.scheduledAt)}</span>
            </div>
          ))}
          {safeArray(related?.tickets).slice(0, 5).map((item) => (
            <div key={item._id} className="assistant-mini-row">
              <span>{item.ticketKey || item.title}</span>
              <span>{item.status}</span>
            </div>
          ))}
        </DetailCard>
      ) : null}
    </div>
  );
}

export default function UnifiedAssistantDashboard() {
  const navigate = useNavigate();
  const socket = useSocket();
  const { user } = useAuth();
  const searchInputRef = useRef(null);
  const messageScrollerRef = useRef(null);

  const [hospitalScope, setHospitalScope] = useState("");
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [selection, setSelection] = useState(null);
  const [recordData, setRecordData] = useState(null);
  const [recordLoading, setRecordLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchMsg, setSearchMsg] = useState("");
  const [channelMessages, setChannelMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [draft, setDraft] = useState("");
  const [ticketNote, setTicketNote] = useState("");
  const [ticketSaving, setTicketSaving] = useState(false);
  const [aiDraft, setAiDraft] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [surfaceFilter, setSurfaceFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [refreshTick, setRefreshTick] = useState(0);
  const [workspaceSettings, setWorkspaceSettings] = useState(null);
  const [handoffLogs, setHandoffLogs] = useState([]);
  const [modeDraft, setModeDraft] = useState("ASSIST");
  const [availabilityDraft, setAvailabilityDraft] = useState("AVAILABLE");
  const [handoffNote, setHandoffNote] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [handoffSaving, setHandoffSaving] = useState(false);
  const [activeConsultationCall, setActiveConsultationCall] = useState(null);
  const [callActionLoading, setCallActionLoading] = useState("");

  const role = String(user?.role || "").toUpperCase();
  const canOpenConsultationMonitor = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role);
  const canOpenFinancials = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role);
  const canOpenFraudGuard = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role);
  const canOpenDeveloper = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role);
  const canRouteOutsideWorkspace = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role);
  const canBlockCalls = ["SUPER_ASSISTANT", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role);
  const canOperateCalls = ["SUPER_ASSISTANT", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER", "HOSPITAL_ADMIN"].includes(role);
  const consultationRoomRole = role === "PATIENT" ? "PATIENT" : "DOCTOR";
  const isGlobal = Boolean(overview?.scope?.global);

  const syncWorkspaceState = (settings, logs) => {
    const nextSettings = settings || null;
    setWorkspaceSettings(nextSettings);
    setHandoffLogs(safeArray(logs));
    setModeDraft(nextSettings?.operatingMode || "ASSIST");
    setAvailabilityDraft(nextSettings?.humanAvailability?.status || "AVAILABLE");
    setHandoffNote((current) => (current.trim() ? current : nextSettings?.humanAvailability?.note || ""));
  };

  const loadOverview = async () => {
    setLoading(true);
    setMessage("");
    try {
      const data = await getUnifiedAssistantOverview({ hospitalId: hospitalScope || undefined });
      setOverview(data || null);
      syncWorkspaceState(data?.assistantWorkspace || null, data?.assistantHandoffLogs || []);
      const preferredSelection =
        selection && selection.type !== "channel"
          ? selection
          : data?.channels?.[0]
            ? { type: "channel", item: data.channels[0] }
            : data?.tickets?.[0]
              ? { type: "ticket", item: data.tickets[0] }
              : data?.calls?.[0]
                ? { type: "call", item: data.calls[0] }
                : data?.alerts?.[0]
                  ? { type: "alert", item: data.alerts[0] }
                  : null;
      if (!selection && preferredSelection) setSelection(preferredSelection);
    } catch (err) {
      setOverview(null);
      setMessage(err?.message || "Failed to load unified assistant workspace.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, [hospitalScope, refreshTick]);

  useEffect(() => {
    if (!selection) {
      setRecordData(null);
      return;
    }

    const supportedKinds = new Set(["patient", "hospital", "claim", "ticket", "call", "user", "audit", "invoice"]);
    let kind = null;
    let id = null;

    if (selection.type === "record") {
      kind = selection.item?.kind;
      id = selection.item?.id;
    } else if (selection.type === "ticket") {
      kind = "ticket";
      id = selection.item?._id;
    } else if (selection.type === "call") {
      kind = "call";
      id = selection.item?._id;
    } else if (selection.type === "alert") {
      kind = selection.item?.entityKind;
      id = selection.item?.entityId;
    }

    if (!kind || !id || !supportedKinds.has(kind)) {
      setRecordData(null);
      return;
    }

    let cancelled = false;
    setRecordLoading(true);
    getUnifiedAssistantRecord({ kind, id, hospitalId: hospitalScope || undefined })
      .then((data) => {
        if (!cancelled) setRecordData(data || null);
      })
      .catch((err) => {
        if (!cancelled) {
          setRecordData(null);
          setMessage(err?.message || "Failed to load selected record.");
        }
      })
      .finally(() => {
        if (!cancelled) setRecordLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selection, hospitalScope]);

  useEffect(() => {
    if (selection?.type !== "call") {
      setActiveConsultationCall(null);
    }
  }, [selection?.type]);

  const activeChannelId = selection?.type === "channel" ? selection.item?._id : "";

  const loadMessages = async (channelId, cursor = "", append = false) => {
    if (!channelId) {
      setChannelMessages([]);
      setNextCursor(null);
      return;
    }
    setMessagesLoading(true);
    try {
      const data = await listAssistantMessages({ channelId, cursor, limit: 30 });
      const rows = Array.isArray(data?.items) ? [...data.items].reverse() : [];
      setNextCursor(data?.nextCursor || null);
      setChannelMessages((prev) => (append ? [...rows, ...prev] : rows));
    } catch (err) {
      setChannelMessages([]);
      setNextCursor(null);
      setMessage(err?.message || "Failed to load channel messages.");
    } finally {
      setMessagesLoading(false);
    }
  };

  useEffect(() => {
    if (!activeChannelId) {
      setChannelMessages([]);
      setNextCursor(null);
      return;
    }
    loadMessages(activeChannelId);
  }, [activeChannelId]);

  useEffect(() => {
    if (!socket || !activeChannelId) return;
    socket.emit("communication:join", { channelId: activeChannelId });
    const onMsg = (incoming) => {
      if (String(incoming?.channel) !== String(activeChannelId)) return;
      setChannelMessages((prev) => {
        if (prev.some((item) => String(item._id) === String(incoming._id))) return prev;
        return [...prev, incoming];
      });
      setOverview((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          channels: Array.isArray(prev.channels)
            ? prev.channels.map((channel) =>
                String(channel._id) === String(activeChannelId)
                  ? {
                      ...channel,
                      lastMessage: {
                        body: incoming.body,
                        senderRole: incoming.senderRole,
                        createdAt: incoming.createdAt,
                      },
                    }
                  : channel
              )
            : prev.channels,
        };
      });
    };
    socket.on("communication:message", onMsg);
    return () => {
      socket.emit("communication:leave", { channelId: activeChannelId });
      socket.off("communication:message", onMsg);
    };
  }, [socket, activeChannelId]);

  useEffect(() => {
    if (!messageScrollerRef.current) return;
    messageScrollerRef.current.scrollTop = messageScrollerRef.current.scrollHeight;
  }, [channelMessages, aiDraft, selection]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchResults([]);
      setSearchMsg("");
      return;
    }
    const timer = setTimeout(() => {
      setSearching(true);
      searchUnifiedAssistant({ q: query, hospitalId: hospitalScope || undefined, limit: 6 })
        .then((data) => {
          const items = Array.isArray(data?.items) ? data.items : [];
          setSearchResults(items);
          setSearchMsg(items.length ? "" : "No records found.");
        })
        .catch((err) => {
          setSearchResults([]);
          setSearchMsg(err?.message || "Search failed.");
        })
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, hospitalScope]);

  const filteredTickets = useMemo(() => {
    const rows = Array.isArray(overview?.tickets) ? overview.tickets : [];
    return rows.filter((ticket) => {
      if (surfaceFilter !== "ALL" && String(ticket.status || "") !== surfaceFilter) return false;
      if (priorityFilter !== "ALL" && String(ticket.priority || "") !== priorityFilter) return false;
      return true;
    });
  }, [overview?.tickets, surfaceFilter, priorityFilter]);

  const filteredCalls = useMemo(() => {
    const rows = Array.isArray(overview?.calls) ? overview.calls : [];
    if (surfaceFilter === "ALL") return rows;
    return rows.filter((call) => String(call.status || "") === surfaceFilter);
  }, [overview?.calls, surfaceFilter]);

  const filteredAlerts = useMemo(() => {
    const rows = Array.isArray(overview?.alerts) ? overview.alerts : [];
    if (priorityFilter === "ALL") return rows;
    return rows.filter((alert) => String(alert.severity || "") === priorityFilter);
  }, [overview?.alerts, priorityFilter]);

  const entityContext = currentEntityContext(selection, recordData);
  const selectedRecord = buildSelectionRecord(selection, recordData);
  const selectedCall = selection?.type === "call" ? (recordData?.record || selection.item) : null;

  const sendMessage = async () => {
    const body = draft.trim();
    if (!body || !activeChannelId) return;
    try {
      await sendAssistantMessage({ channelId: activeChannelId, body });
      setDraft("");
      await loadMessages(activeChannelId);
    } catch (err) {
      setMessage(err?.message || "Failed to send message.");
    }
  };

  const askAi = async () => {
    if (!selection) return;
    setAiLoading(true);
    setAiDraft("");
    try {
      const prompt = buildAiPrompt(selection, recordData, workspaceSettings);
      const routeContext = "unified-assistant";
      const data = await chatAssistant({
        request: {
          message: prompt,
          userMessage: prompt,
          pageContext: routeContext,
          channel: "web",
          client: "browser",
        },
        aiContext: {
          pageContext: routeContext,
        },
      });
      setAiDraft(data?.answer || data?.text || "No AI suggestion returned.");
    } catch (err) {
      setAiDraft(err?.message || "AI suggestion is unavailable right now.");
    } finally {
      setAiLoading(false);
    }
  };

  const updateTicket = async (status) => {
    const ticketId = recordData?.record?._id || selection?.item?._id;
    if (!ticketId) return;
    setTicketSaving(true);
    try {
      await updateSupportTicket(ticketId, { status, note: ticketNote });
      setTicketNote("");
      setMessage(`Ticket updated to ${status}.`);
      setRefreshTick((value) => value + 1);
      const fresh = await getUnifiedAssistantRecord({ kind: "ticket", id: ticketId, hospitalId: hospitalScope || undefined });
      setRecordData(fresh);
    } catch (err) {
      setMessage(err?.message || "Failed to update support ticket.");
    } finally {
      setTicketSaving(false);
    }
  };

  const blockCall = async () => {
    const callId = recordData?.record?._id || selection?.item?._id;
    if (!callId || !canBlockCalls) return;
    setCallActionLoading(`block-${callId}`);
    try {
      await apiFetch(`/api/appointments/calls/${callId}/block`, {
        method: "PATCH",
        body: { reason: "Blocked from Unified Assistant Dashboard" },
      });
      setMessage("Call blocked.");
      setActiveConsultationCall(null);
      setRefreshTick((value) => value + 1);
      const fresh = await getUnifiedAssistantRecord({ kind: "call", id: callId, hospitalId: hospitalScope || undefined });
      setRecordData(fresh);
    } catch (err) {
      setMessage(err?.message || "Failed to block call.");
    } finally {
      setCallActionLoading("");
    }
  };

  const openEmbeddedConsultation = async () => {
    const callId = selectedCall?._id;
    if (!callId || !canOperateCalls) return;
    setCallActionLoading(`open-${callId}`);
    try {
      if (String(selectedCall?.status || "") !== "ACTIVE") {
        await apiFetch(`/api/appointments/calls/${callId}/activate`, {
          method: "PATCH",
        });
      }
      const fresh = await getUnifiedAssistantRecord({ kind: "call", id: callId, hospitalId: hospitalScope || undefined });
      setRecordData(fresh);
      setActiveConsultationCall(fresh?.record || selectedCall);
      setMessage("Consultation room opened inside the assistant workspace.");
      setRefreshTick((value) => value + 1);
    } catch (err) {
      setMessage(err?.message || "Could not open consultation room.");
    } finally {
      setCallActionLoading("");
    }
  };

  const endEmbeddedConsultation = async (call = activeConsultationCall || selectedCall) => {
    const callId = call?._id;
    if (!callId) return;
    setCallActionLoading(`end-${callId}`);
    try {
      await apiFetch(`/api/appointments/calls/${callId}/end`, {
        method: "PATCH",
      });
      setActiveConsultationCall(null);
      setMessage("Consultation ended.");
      setRefreshTick((value) => value + 1);
      const fresh = await getUnifiedAssistantRecord({ kind: "call", id: callId, hospitalId: hospitalScope || undefined });
      setRecordData(fresh);
    } catch (err) {
      setMessage(err?.message || "Failed to end consultation.");
    } finally {
      setCallActionLoading("");
    }
  };

  const openRelatedRecord = () => {
    if (!selection) return;
    if (selection.type === "alert" && selection.item?.entityKind && selection.item?.entityId) {
      setSelection({
        type: "record",
        item: {
          kind: selection.item.entityKind,
          id: selection.item.entityId,
        },
      });
      return;
    }
    if (selection.type === "call" && recordData?.record?.patient?._id) {
      setSelection({ type: "record", item: { kind: "patient", id: recordData.record.patient._id } });
    }
  };

  const openSpecificRecord = (kind, id) => {
    if (!kind || !id) return;
    setSelection({ type: "record", item: { kind, id } });
  };

  const openDirectPath = (path) => {
    if (!path) return;
    navigate(path);
  };

  const openRecordDestination = (kind, record) => {
    if (!kind || !record) return;
    const path = canRouteOutsideWorkspace ? resolveUnifiedRecordPath(kind, record) : "";
    if (path) {
      navigate(path);
      return;
    }
    if (record?._id) {
      openSpecificRecord(kind, record._id);
    }
  };

  const openMainAction = (target) => {
    if (target === "search") {
      searchInputRef.current?.focus();
      return;
    }
    if (target === "financials") {
      if (!canOpenFinancials) {
        setMessage("Financial controls for this role are already surfaced inside the workspace.");
        return;
      }
      navigate("/app/revenue/financials/index");
      return;
    }
    if (target === "fraud") {
      if (!canOpenFraudGuard) {
        setMessage("Fraud actions for this role stay inside the unified workspace.");
        return;
      }
      navigate("/app/governance/fraud/index");
      return;
    }
    if (target === "developer") {
      navigate("/app/platform/dev/home");
      return;
    }
    if (target === "records") {
      openRelatedRecord();
      return;
    }
    if (target === "ai") {
      askAi();
    }
  };

  const saveWorkspaceMode = async () => {
    setSettingsSaving(true);
    setMessage("");
    try {
      const data = await updateUnifiedAssistantSettings({
        hospitalId: hospitalScope || undefined,
        operatingMode: modeDraft,
        humanAvailability: {
          status: availabilityDraft,
          note: handoffNote,
        },
        handoffPolicy: workspaceSettings?.handoffPolicy || undefined,
        entityKind: entityContext.kind,
        entityId: entityContext.id,
      });
      syncWorkspaceState(data?.settings, data?.handoffLogs);
      setMessage(`Assistant mode saved as ${formatModeLabel(data?.settings?.operatingMode || modeDraft)}.`);
    } catch (err) {
      setMessage(err?.message || "Failed to save assistant operating mode.");
      try {
        const data = await getUnifiedAssistantSettings({ hospitalId: hospitalScope || undefined });
        syncWorkspaceState(data?.settings, data?.handoffLogs);
      } catch {}
    } finally {
      setSettingsSaving(false);
    }
  };

  const createHandoffEntry = async () => {
    const note = handoffNote.trim();
    if (!note) {
      setMessage("Add a short handoff note before logging the handoff.");
      return;
    }
    setHandoffSaving(true);
    setMessage("");
    try {
      const data = await logUnifiedAssistantHandoff({
        hospitalId: hospitalScope || undefined,
        note,
        fromMode: workspaceSettings?.operatingMode || modeDraft,
        toMode: modeDraft,
        fromAvailability: workspaceSettings?.humanAvailability?.status || availabilityDraft,
        toAvailability: availabilityDraft,
        entityKind: entityContext.kind,
        entityId: entityContext.id,
      });
      setHandoffLogs(safeArray(data?.handoffLogs));
      setMessage("Handoff log recorded.");
      setHandoffNote("");
    } catch (err) {
      setMessage(err?.message || "Failed to log handoff.");
    } finally {
      setHandoffSaving(false);
    }
  };

  const currentMode = workspaceSettings?.operatingMode || modeDraft;
  const currentAvailability = workspaceSettings?.humanAvailability?.status || availabilityDraft;
  const takeoverActive = Boolean(workspaceSettings?.takeover?.active || currentMode === "TAKEOVER");

  return (
    <DashboardHomeShell
      className="assistant-workspace-page"
      shellKey="platform_unified_assistant"
      kicker="Platform"
      title="Unified Assistant"
      subtitle="Human + AI support workspace for chats, calls, tickets, financial controls, fraud signals, and live records."
      actions={[
        { label: loading ? "Refreshing..." : "Refresh", onClick: () => setRefreshTick((value) => value + 1), variant: "secondary", disabled: loading },
        { label: "Support Tickets", path: "/app/platform/support/tickets", variant: "secondary" },
        { label: "Communication Center", path: "/app/platform/inbox/communication", variant: "secondary" },
      ]}
    >
      {isGlobal ? (
        <DashboardSection
          title="Hospital scope"
          subtitle="Limit results to a specific hospital ID when you need focused investigations."
        >
          <div className="grid info-grid">
            <input
              value={hospitalScope}
              onChange={(event) => setHospitalScope(event.target.value)}
              placeholder="Hospital ID scope"
            />
          </div>
        </DashboardSection>
      ) : null}

      <section className="section assistant-workspace-search-section">
        <div className="card premium-card assistant-workspace-search-card">
          <div className="assistant-workspace-search-row">
            <div className="assistant-workspace-search-inputs">
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search patient ID, hospital ID, claim ID, ticket, user, or name"
              />
              <div className="assistant-workspace-search-help muted">
                Patient ID | Hospital ID | Claim ID | Name
              </div>
            </div>
            <div className="assistant-workspace-summary-strip">
              <MetricChip
                label="Chats"
                value={overview?.summary?.activeChats ?? 0}
                onClick={() => {
                  if (overview?.channels?.[0]) setSelection({ type: "channel", item: overview.channels[0] });
                }}
              />
                <MetricChip
                  label="Calls"
                  value={overview?.summary?.activeCalls ?? 0}
                  onClick={() => {
                    if (canOpenConsultationMonitor) navigate("/app/operations/consultations/monitor");
                    else if (overview?.calls?.[0]) setSelection({ type: "call", item: overview.calls[0] });
                  }}
                />
              <MetricChip
                label="Tickets"
                value={overview?.summary?.openTickets ?? 0}
                onClick={() => {
                  if (canRouteOutsideWorkspace) navigate("/app/platform/support/tickets");
                  else if (overview?.tickets?.[0]) setSelection({ type: "ticket", item: overview.tickets[0] });
                }}
              />
              <MetricChip
                label="Fraud Alerts"
                value={overview?.summary?.fraudAlerts ?? 0}
                onClick={() => {
                  if (canOpenFraudGuard) navigate("/app/governance/fraud/index");
                  else if (overview?.alerts?.[0]) setSelection({ type: "alert", item: overview.alerts[0] });
                }}
              />
              <MetricChip
                label="Pending Claims"
                value={overview?.summary?.pendingClaims ?? 0}
                onClick={() => {
                  if (canRouteOutsideWorkspace) navigate("/app/governance/claims/index");
                  else if (overview?.alerts?.[0]) setSelection({ type: "alert", item: overview.alerts[0] });
                }}
              />
              <MetricChip
                label="System Errors"
                value={overview?.summary?.systemErrors ?? 0}
                onClick={() => {
                  if (canRouteOutsideWorkspace) navigate("/app/platform/dev/home");
                  else setMessage("System errors stay in the Live Context panel for this role.");
                }}
              />
            </div>
          </div>
          {(searching || searchMsg || searchResults.length > 0) && (
            <div className="assistant-search-results">
              {searching ? <div className="muted">Searching…</div> : null}
              {!searching && searchMsg ? <div className="muted">{searchMsg}</div> : null}
              {!searching && searchResults.map((item) => (
                <button
                  type="button"
                  key={`${item.kind}-${item.id}`}
                  className="assistant-search-result"
                  onClick={() => {
                    setSelection({ type: "record", item });
                    setSearchQuery("");
                    setSearchResults([]);
                    setSearchMsg("");
                  }}
                >
                  <div>
                    <strong>{item.title}</strong>
                    <div className="muted">{item.subtitle}</div>
                  </div>
                  <div className="assistant-badge-row">
                    <span className="assistant-badge">{item.kind}</span>
                    {(item.badges || []).slice(0, 2).map((badge) => (
                      <span key={badge} className="assistant-badge subtle">{badge}</span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {message ? <div className="card">{message}</div> : null}

      <section className="section assistant-workspace-shell">
        <aside className="card premium-card assistant-workspace-left">
          <div className="assistant-panel-header">
            <h3>Communication Hub</h3>
            <div className="assistant-filter-row">
              <select value={surfaceFilter} onChange={(event) => setSurfaceFilter(event.target.value)}>
                <option value="ALL">All Statuses</option>
                <option value="OPEN">Open</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="ESCALATED">Escalated</option>
                <option value="REQUESTED">Requested</option>
                <option value="ACTIVE">Active</option>
              </select>
              <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
                <option value="ALL">All Severity</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
          </div>

          <div className="assistant-panel-section">
            <h4>Chats</h4>
            <div className="assistant-list">
              {(overview?.channels || []).map((channel) => (
                <button
                  type="button"
                  key={channel._id}
                  className={`assistant-list-item${selection?.type === "channel" && String(selection.item?._id) === String(channel._id) ? " active" : ""}`}
                  onClick={() => setSelection({ type: "channel", item: channel })}
                >
                  <div>
                    <strong>{channel.name}</strong>
                    <div className="muted">{channel.lastMessage?.body || channel.description || "No messages yet."}</div>
                  </div>
                  <span className="assistant-badge">{channel.lastMessage?.senderRole || "CHAT"}</span>
                </button>
              ))}
              {!overview?.channels?.length ? <div className="muted">No channels available.</div> : null}
            </div>
          </div>

          <div className="assistant-panel-section">
            <h4>Calls</h4>
            <div className="assistant-list compact">
              {filteredCalls.map((call) => (
                <button
                  type="button"
                  key={call._id}
                  className={`assistant-list-item${selection?.type === "call" && String(selection.item?._id) === String(call._id) ? " active" : ""}`}
                  onClick={() => setSelection({ type: "call", item: call })}
                >
                  <div>
                    <strong>{call.callType} • {call.status}</strong>
                    <div className="muted">{patientName(call.patient)} • {call.doctor?.name || "Doctor"}</div>
                  </div>
                  <span className={`assistant-badge ${badgeClass(call.status)}`}>{call.status}</span>
                </button>
              ))}
              {!filteredCalls.length ? <div className="muted">No call sessions in scope.</div> : null}
            </div>
          </div>

          <div className="assistant-panel-section">
            <h4>Support Tickets</h4>
            <div className="assistant-list compact">
              {filteredTickets.map((ticket) => (
                <button
                  type="button"
                  key={ticket._id}
                  className={`assistant-list-item${selection?.type === "ticket" && String(selection.item?._id) === String(ticket._id) ? " active" : ""}`}
                  onClick={() => setSelection({ type: "ticket", item: ticket })}
                >
                  <div>
                    <strong>{ticket.title}</strong>
                    <div className="muted">{ticket.ticketKey} • {ticket.hospital?.name || "Platform"}</div>
                  </div>
                  <span className={`assistant-badge ${badgeClass(ticket.priority)}`}>{ticket.priority}</span>
                </button>
              ))}
              {!filteredTickets.length ? <div className="muted">No support tickets in scope.</div> : null}
            </div>
          </div>

          <div className="assistant-panel-section">
            <h4>Alerts</h4>
            <div className="assistant-list compact">
              {filteredAlerts.map((alert) => (
                <button
                  type="button"
                  key={alert.id}
                  className={`assistant-list-item${selection?.type === "alert" && selection.item?.id === alert.id ? " active" : ""}`}
                  onClick={() => setSelection({ type: "alert", item: alert })}
                >
                  <div>
                    <strong>{alert.title}</strong>
                    <div className="muted">{alert.subtitle}</div>
                  </div>
                  <span className={`assistant-badge ${badgeClass(alert.severity)}`}>{alert.severity}</span>
                </button>
              ))}
              {!filteredAlerts.length ? <div className="muted">No alerts in scope.</div> : null}
            </div>
          </div>
        </aside>

        <main className="card premium-card assistant-workspace-main">
          <div className="assistant-panel-header">
            <div>
              <h3>
                {selection?.type === "channel" ? selection.item?.name || "Conversation" :
                  selection?.type === "ticket" ? (recordData?.record?.title || selection.item?.title || "Support ticket") :
                  selection?.type === "call" ? `${recordData?.record?.callType || selection.item?.callType || "Call"} session` :
                  selection?.type === "alert" ? selection.item?.title || "Alert detail" :
                  selection?.type === "record" ? `${selection.item?.kind || "Record"} detail` :
                  "Active Workspace"}
              </h3>
              <p className="muted">
                {selection?.type === "channel" ? selection.item?.description || "Live communication thread." :
                  selection?.type === "ticket" ? `${recordData?.record?.ticketKey || selection.item?.ticketKey || "Ticket"} • support coordination` :
                  selection?.type === "call" ? `${patientName(recordData?.record?.patient || selection.item?.patient)} • ${recordData?.record?.doctor?.name || selection.item?.doctor?.name || "Doctor"}` :
                  selection?.type === "alert" ? selection.item?.subtitle || "Operational alert" :
                  selection?.type === "record" ? selection.item?.subtitle || "Full profile context" :
                  "Select a chat, call, ticket, alert, or search result."}
              </p>
            </div>
            <div className="welcome-actions">
              <button type="button" className="btn-secondary" onClick={askAi} disabled={!selection || aiLoading}>
                {aiLoading ? "Asking AI..." : "AI Suggest"}
              </button>
              {selection?.type === "call" && canOpenConsultationMonitor ? (
                <button type="button" className="btn-secondary" onClick={() => navigate("/app/operations/consultations/monitor")}>
                  Open Consultation Monitor
                </button>
              ) : null}
            </div>
          </div>

          {selection?.type === "channel" ? (
            <div className="assistant-conversation-shell">
              <div className="assistant-message-stack" ref={messageScrollerRef}>
                {messagesLoading ? <div className="muted">Loading messages...</div> : null}
                {!messagesLoading && !channelMessages.length ? <div className="muted">No messages in this channel.</div> : null}
                {nextCursor ? (
                  <button type="button" className="btn-secondary assistant-load-more" onClick={() => loadMessages(activeChannelId, nextCursor, true)}>
                    Load older messages
                  </button>
                ) : null}
                {channelMessages.map((item) => {
                  const mine = String(item.sender?._id || item.sender) === String(user?._id);
                  return (
                    <div key={item._id} className={`assistant-chat-bubble ${mine ? "mine" : "theirs"}`}>
                      <div className="assistant-chat-meta">
                        <strong>{item.sender?.name || item.senderRole || "User"}</strong>
                        <span>{formatDate(item.createdAt)}</span>
                      </div>
                      <div>{item.body}</div>
                    </div>
                  );
                })}
              </div>

              {aiDraft ? (
                <div className="assistant-ai-suggestion card">
                  <div className="assistant-panel-header small">
                    <strong>AI Suggested Reply</strong>
                    <button type="button" className="btn-secondary" onClick={() => setDraft(aiDraft)}>
                      Use as Reply
                    </button>
                  </div>
                  <div className="assistant-ai-copy">{aiDraft}</div>
                </div>
              ) : null}

              <div className="assistant-message-composer">
                <textarea
                  rows={3}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Type a reply or use AI Suggest for a draft..."
                />
                <div className="assistant-composer-actions">
                  <button type="button" className="btn-primary" onClick={sendMessage} disabled={!draft.trim()}>
                    Send
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {selection?.type === "ticket" ? (
            <div className="assistant-ticket-panel">
              {recordLoading ? <div className="muted">Loading ticket...</div> : null}
              {recordData?.record ? (
                <>
                  <TicketRecordView record={recordData.record} onOpenRecord={openSpecificRecord} />
                  <div className="assistant-ticket-actions">
                    <textarea
                      rows={3}
                      value={ticketNote}
                      onChange={(event) => setTicketNote(event.target.value)}
                      placeholder="Comment or resolution note"
                    />
                    <div className="assistant-composer-actions">
                      <button type="button" className="btn-secondary" disabled={ticketSaving} onClick={() => updateTicket("ASSIGNED")}>Mark Assigned</button>
                      <button type="button" className="btn-secondary" disabled={ticketSaving} onClick={() => updateTicket("ESCALATED")}>Escalate</button>
                      <button type="button" className="btn-primary" disabled={ticketSaving} onClick={() => updateTicket("RESOLVED")}>Resolve</button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}

          {selection?.type === "call" ? (
            <div className="assistant-call-panel">
              {recordLoading ? <div className="muted">Loading call session...</div> : null}
              {selectedCall ? (
                <>
                  <CallRecordView record={selectedCall} onOpenRecord={openSpecificRecord} />
                  <div className="assistant-composer-actions assistant-inline-actions-gap">
                    <button type="button" className="btn-secondary" onClick={openRelatedRecord}>View Patient</button>
                    {canOperateCalls ? (
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={openEmbeddedConsultation}
                        disabled={Boolean(callActionLoading)}
                      >
                        {callActionLoading === `open-${selectedCall._id}`
                          ? "Opening Room..."
                          : String(selectedCall?.status || "") === "ACTIVE"
                            ? "Join Live Room"
                            : "Activate & Join Room"}
                      </button>
                    ) : null}
                    {activeConsultationCall ? (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setActiveConsultationCall(null)}
                      >
                        Close Room View
                      </button>
                    ) : null}
                    {canOperateCalls && String(selectedCall?.status || "") === "ACTIVE" ? (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => endEmbeddedConsultation(selectedCall)}
                        disabled={callActionLoading === `end-${selectedCall._id}`}
                      >
                        {callActionLoading === `end-${selectedCall._id}` ? "Ending..." : "End Call"}
                      </button>
                    ) : null}
                    {canBlockCalls ? (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={blockCall}
                        disabled={callActionLoading === `block-${selectedCall._id}`}
                      >
                        {callActionLoading === `block-${selectedCall._id}` ? "Blocking..." : "Block Call"}
                      </button>
                    ) : null}
                    {canOpenConsultationMonitor ? <button type="button" className="btn-secondary" onClick={() => navigate("/app/operations/consultations/monitor")}>Consultation Monitor</button> : null}
                  </div>

                  {activeConsultationCall && String(activeConsultationCall?._id) === String(selectedCall?._id) ? (
                    <div className="assistant-consultation-embed">
                      <ConsultationRoom
                        call={activeConsultationCall}
                        role={consultationRoomRole}
                        onClose={() => setActiveConsultationCall(null)}
                        onEnded={async (call) => {
                          await endEmbeddedConsultation(call);
                        }}
                      />
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}

          {selection?.type === "alert" ? (
            <div className="assistant-alert-panel">
              <DetailCard title={selection.item?.title} subtitle={selection.item?.subtitle} actions={(
                <>
                  <span className={`assistant-badge ${badgeClass(selection.item?.severity)}`}>{selection.item?.severity}</span>
                  <span className="assistant-badge subtle">{selection.item?.type}</span>
                  {selection.item?.riskScore != null ? <span className="assistant-badge subtle">Risk {selection.item.riskScore}</span> : null}
                </>
              )} onOpen={() => {
                if (recordData?.kind && recordData?.record) openRecordDestination(recordData.kind, recordData.record);
                else openRelatedRecord();
              }}>
                <TagList items={selection.item?.flags || []} tone="subtle" />
                <div className="assistant-composer-actions">
                  <button type="button" className="btn-secondary" onClick={openRelatedRecord}>Open Related Record</button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => (canOpenFraudGuard ? navigate("/app/governance/fraud/index") : setMessage("Fraud review stays inside this workspace for your role."))}
                  >
                    Open Fraud Guard
                  </button>
                </div>
              </DetailCard>
              {recordLoading ? <div className="muted">Loading related context...</div> : null}
              {recordData?.record ? (
                <StructuredRecordRenderer
                  kind={recordData.kind}
                  record={recordData.record}
                  related={recordData.related}
                  onOpenRecord={openSpecificRecord}
                  onNavigateRecord={openRecordDestination}
                />
              ) : null}
            </div>
          ) : null}

          {selection?.type === "record" ? (
            <div className="assistant-record-panel">
              {recordLoading ? <div className="muted">Loading record...</div> : null}
              {recordData?.record ? (
                <StructuredRecordRenderer
                  kind={recordData.kind}
                  record={recordData.record}
                  related={recordData.related}
                  onOpenRecord={openSpecificRecord}
                  onNavigateRecord={openRecordDestination}
                />
              ) : null}
            </div>
          ) : null}

          {!selection ? (
            <div className="assistant-empty-state">
              <h3>Assistant Workspace Ready</h3>
              <p className="muted">Select a chat, call, ticket, alert, or search result to start working.</p>
              <div className="assistant-badge-row">
                <span className="assistant-badge">Patient support</span>
                <span className="assistant-badge">Hospital support</span>
                <span className="assistant-badge">Claims & finance</span>
                <span className="assistant-badge">Developer triage</span>
              </div>
            </div>
          ) : null}
        </main>

        <aside className="card premium-card assistant-workspace-right">
          <div className="assistant-panel-header">
            <h3>Live Context</h3>
            {recordLoading ? <span className="muted">Loading…</span> : null}
          </div>

          <div className="assistant-right-stack">
            <DetailCard
              title="AI Operating Mode"
              subtitle="Persisted human + AI routing for this workspace scope"
              actions={(
                <>
                  <span className={`assistant-badge ${badgeClass(currentMode === "TAKEOVER" ? "HIGH" : currentMode === "AUTO" ? "MEDIUM" : "LOW")}`}>
                    {formatModeLabel(currentMode)}
                  </span>
                  <span className={`assistant-badge ${badgeClass(currentAvailability)}`}>{formatAvailabilityLabel(currentAvailability)}</span>
                </>
              )}
            >
              <div className="assistant-mode-grid">
                {MODE_OPTIONS.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={`assistant-mode-toggle${modeDraft === mode ? " active" : ""}`}
                    onClick={() => setModeDraft(mode)}
                  >
                    <strong>{formatModeLabel(mode)}</strong>
                    <span>{mode === "ASSIST" ? "Human-guided replies" : mode === "AUTO" ? "AI handles when humans are away" : "Human override and control"}</span>
                  </button>
                ))}
              </div>

              <div className="assistant-settings-grid">
                <label>
                  Human Availability
                  <select value={availabilityDraft} onChange={(event) => setAvailabilityDraft(event.target.value)}>
                    {AVAILABILITY_OPTIONS.map((value) => (
                      <option key={value} value={value}>{formatAvailabilityLabel(value)}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Handoff / Status Note
                  <textarea
                    rows={3}
                    value={handoffNote}
                    onChange={(event) => setHandoffNote(event.target.value)}
                    placeholder="Why AI should assist, auto-handle, or hand off this workflow"
                  />
                </label>
              </div>

              <div className="assistant-checkbox-row">
                <label>
                  <input
                    type="checkbox"
                    checked={workspaceSettings?.handoffPolicy?.autoReplyWhenUnavailable !== false}
                    onChange={(event) =>
                      setWorkspaceSettings((prev) => ({
                        ...(prev || {}),
                        handoffPolicy: {
                          ...(prev?.handoffPolicy || {}),
                          autoReplyWhenUnavailable: event.target.checked,
                        },
                      }))
                    }
                  />
                  Auto-reply when humans are unavailable
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={workspaceSettings?.handoffPolicy?.autoEscalateCritical !== false}
                    onChange={(event) =>
                      setWorkspaceSettings((prev) => ({
                        ...(prev || {}),
                        handoffPolicy: {
                          ...(prev?.handoffPolicy || {}),
                          autoEscalateCritical: event.target.checked,
                        },
                      }))
                    }
                  />
                  Escalate critical issues automatically
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={Boolean(workspaceSettings?.handoffPolicy?.requireReasonForTakeover)}
                    onChange={(event) =>
                      setWorkspaceSettings((prev) => ({
                        ...(prev || {}),
                        handoffPolicy: {
                          ...(prev?.handoffPolicy || {}),
                          requireReasonForTakeover: event.target.checked,
                        },
                      }))
                    }
                  />
                  Require a reason before takeover mode
                </label>
              </div>

              {takeoverActive ? (
                <div className="assistant-mode-banner warning">
                  Takeover active {workspaceSettings?.takeover?.entityKind ? `• ${formatModeLabel(workspaceSettings.takeover.entityKind)}` : ""}
                  {workspaceSettings?.takeover?.startedAt ? ` • since ${formatDate(workspaceSettings.takeover.startedAt)}` : ""}
                </div>
              ) : null}

              <div className="assistant-composer-actions">
                <button type="button" className="btn-primary" onClick={saveWorkspaceMode} disabled={settingsSaving}>
                  {settingsSaving ? "Saving..." : "Save Mode"}
                </button>
                <button type="button" className="btn-secondary" onClick={createHandoffEntry} disabled={handoffSaving}>
                  {handoffSaving ? "Logging..." : "Log Handoff"}
                </button>
              </div>
            </DetailCard>

            <DetailCard title="Recent Handoff Logs" subtitle="Audit trail for AI mode, availability, and human takeover changes">
              {handoffLogs.length ? (
                <div className="assistant-timeline">
                  {handoffLogs.map((row) => (
                    <div key={row._id} className="assistant-timeline-item">
                      <div className="assistant-detail-row top">
                        <strong>{formatModeLabel(row.action?.replace("UNIFIED_ASSISTANT_", "").replaceAll("_", " "))}</strong>
                        <span className="assistant-detail-value">{formatDate(row.createdAt)}</span>
                      </div>
                      <div className="muted">{row.actor} • {row.actorRole || "SYSTEM"}</div>
                      <div className="muted">
                        {row.fromMode || row.toMode ? `${formatModeLabel(row.fromMode || currentMode)} → ${formatModeLabel(row.toMode || currentMode)}` : "Mode unchanged"}
                        {row.fromAvailability || row.toAvailability
                          ? ` • ${formatAvailabilityLabel(row.fromAvailability || currentAvailability)} → ${formatAvailabilityLabel(row.toAvailability || currentAvailability)}`
                          : ""}
                      </div>
                      {row.note ? <div>{row.note}</div> : null}
                      {row.entityKind || row.entityId ? (
                        <div className="muted">{formatModeLabel(row.entityKind)} • {row.entityId}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="muted">No handoff activity recorded in this scope yet.</div>
              )}
            </DetailCard>

            <SidebarContext
              selection={selection}
              recordData={recordData}
              overview={overview}
              onOpenRecord={openSpecificRecord}
              onNavigateRecord={openRecordDestination}
              onNavigatePath={openDirectPath}
            />
          </div>
        </aside>
      </section>

      <section className="section assistant-workspace-actionbar-section">
        <div className="card premium-card assistant-workspace-actionbar">
          <button type="button" className="btn-secondary" onClick={() => openMainAction("search")}>Search</button>
          <button type="button" className="btn-secondary" onClick={() => openMainAction("records")} disabled={!selection}>View Records</button>
          <button type="button" className="btn-secondary" onClick={() => openMainAction("financials")} disabled={!canOpenFinancials && !overview?.financialSummary}>Open Financials</button>
          <button type="button" className="btn-secondary" onClick={() => openMainAction("fraud")}>Flag Fraud</button>
          <button type="button" className="btn-secondary" onClick={() => openMainAction("developer")} disabled={!canOpenDeveloper}>Open Dev Tools</button>
          <button type="button" className="btn-primary" onClick={() => openMainAction("ai")} disabled={!selection || aiLoading}>Ask AI</button>
        </div>
      </section>
    </DashboardHomeShell>
  );
}
