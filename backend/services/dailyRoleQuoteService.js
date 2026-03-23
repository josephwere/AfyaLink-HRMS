import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { normalizeRole } from "../utils/normalizeRole.js";

const ROLE_QUOTES = {
  PATIENT: [
    {
      key: "patient-hydration",
      text: "Daily health quote: Small habits matter. Drink water early, take prescribed medicine on time, and do not wait for symptoms to become severe before seeking care.",
    },
    {
      key: "patient-checkup",
      text: "Daily health quote: Preventive care is cheaper than emergency care. Keep up with screenings, follow-up visits, and treatment plans before problems escalate.",
    },
    {
      key: "patient-rest",
      text: "Daily health quote: Healing needs routine. Good sleep, clean nutrition, movement, and medication adherence protect your health more than occasional crisis treatment.",
    },
  ],
  DOCTOR: [
    {
      key: "doctor-document",
      text: "Daily medical quote: Good care is clinical and documented. Clear notes, precise orders, and explicit follow-up instructions protect both patient outcomes and continuity of care.",
    },
    {
      key: "doctor-safety",
      text: "Daily medical quote: Diagnostic discipline prevents harm. Recheck red flags, reconcile history, and close loops on labs and referrals before ending the encounter.",
    },
    {
      key: "doctor-communication",
      text: "Daily medical quote: Explain the plan simply. A patient who understands medication, warning signs, and next steps is more likely to recover safely.",
    },
  ],
  NURSE: [
    {
      key: "nurse-vitals",
      text: "Daily medical quote: Early change is often subtle. Accurate vitals, timely escalation, and complete bedside documentation prevent delayed intervention.",
    },
    {
      key: "nurse-handoff",
      text: "Daily medical quote: A safe shift depends on a clean handoff. Confirm orders, verify medications, and never assume the next team already knows the risk.",
    },
    {
      key: "nurse-patient-education",
      text: "Daily medical quote: Teaching is treatment. When patients understand care instructions, complications and readmissions usually fall.",
    },
  ],
  LAB_TECH: [
    {
      key: "lab-quality",
      text: "Daily medical quote: Reliable results start before the analyzer. Correct labeling, sample integrity, and documented chain of custody protect diagnostic accuracy.",
    },
    {
      key: "lab-turnaround",
      text: "Daily medical quote: Speed matters, but clarity matters more. Flag critical values fast and make sure the right clinician receives them.",
    },
  ],
  PHARMACIST: [
    {
      key: "pharmacy-counsel",
      text: "Daily medical quote: Dispensing is not the last step. Medication counseling, interaction checks, and adherence guidance are part of patient safety.",
    },
    {
      key: "pharmacy-reconciliation",
      text: "Daily medical quote: Reconcile every list. Duplicate therapy, missed allergies, and wrong dosing errors often hide in incomplete medication histories.",
    },
  ],
  RECEPTIONIST: [
    {
      key: "receptionist-triage",
      text: "Daily medical quote: Front desk accuracy protects clinical flow. Correct identity capture, urgent-case escalation, and clean booking details reduce downstream risk.",
    },
    {
      key: "receptionist-compassion",
      text: "Daily medical quote: Calm communication is part of care. Patients remember whether the first person they met helped them feel safe and guided.",
    },
  ],
  HOSPITAL_ADMIN: [
    {
      key: "hospital-admin-compliance",
      text: "Daily medical quote: Sustainable care depends on compliance. Credentialing, staffing, equipment uptime, and clean audit trails matter as much as daily operations.",
    },
    {
      key: "hospital-admin-quality",
      text: "Daily medical quote: Hospitals improve when leaders measure the basics consistently: safety, turnaround time, staffing readiness, and patient trust.",
    },
  ],
  SYSTEM_ADMIN: [
    {
      key: "system-admin-availability",
      text: "Daily medical quote: In healthcare systems, uptime is patient safety. Monitor failures early, verify integrations, and close alert loops before they hit the ward.",
    },
    {
      key: "system-admin-audit",
      text: "Daily medical quote: Secure systems are traceable systems. Strong audit trails, scoped access, and disciplined change control protect care delivery.",
    },
  ],
  SUPER_ADMIN: [
    {
      key: "super-admin-governance",
      text: "Daily medical quote: Governance is clinical infrastructure. When access, compliance, payments, and data quality are tight, frontline teams deliver better care.",
    },
    {
      key: "super-admin-fraud",
      text: "Daily medical quote: Fraud prevention is patient protection. Transparent claims, trusted records, and accountable approvals preserve care budgets for real treatment.",
    },
  ],
};

const ROLE_PATHS = {
  PATIENT: "/patient",
  DOCTOR: "/doctor",
  NURSE: "/nurse",
  LAB_TECH: "/lab-tech",
  PHARMACIST: "/pharmacy",
  RADIOLOGIST: "/radiologist",
  THERAPIST: "/therapist",
  RECEPTIONIST: "/receptionist",
  SURGEON: "/surgeon",
  HOSPITAL_ADMIN: "/hospital-admin",
  HOSPITAL_ADMIN_ASSISTANT: "/hospital-admin",
  HR_MANAGER: "/hr",
  PAYROLL_OFFICER: "/payroll",
  SECURITY_OFFICER: "/security-officer",
  SECURITY_ADMIN: "/security-admin",
  COMMUNITY_HEALTH_WORKER: "/community-health-worker",
  GOVERNMENT_ADMIN: "/system-admin/government-claims",
  GOVERNMENT_REGULATOR: "/system-admin/government-claims",
  GOVERNMENT_AUDITOR: "/system-admin/government-claims",
  GOVERNMENT_INSPECTOR: "/system-admin/government-claims",
  GOVERNMENT_ANALYST: "/system-admin/government-claims",
  SYSTEM_ADMIN: "/system-admin",
  SUPER_ADMIN: "/super-admin",
  SUPER_ASSISTANT: "/system-admin/unified-assistant",
  DEVELOPER: "/developer",
  GUEST: "/",
};

function getNairobiDateStamp(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dayHash(seed) {
  return String(seed)
    .split("")
    .reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 1), 0);
}

function getQuoteForRole(role, quoteDate) {
  const normalizedRole = normalizeRole(role || "PATIENT");
  const pool = ROLE_QUOTES[normalizedRole] || ROLE_QUOTES.PATIENT;
  const index = dayHash(`${normalizedRole}:${quoteDate}`) % pool.length;
  return {
    ...pool[index],
    role: normalizedRole,
    path: ROLE_PATHS[normalizedRole] || "/notifications",
  };
}

export async function deliverDailyRoleQuotes({ date = new Date() } = {}) {
  const quoteDate = getNairobiDateStamp(date);
  const users = await User.find({
    active: true,
  }).select("_id role hospital");

  if (!users.length) {
    return { scanned: 0, created: 0, quoteDate };
  }

  const userIds = users.map((user) => user._id);
  const existing = await Notification.find({
    user: { $in: userIds },
    category: "WELLNESS",
    "meta.kind": "DAILY_ROLE_QUOTE",
    "meta.quoteDate": quoteDate,
  }).select("user");

  const existingSet = new Set(existing.map((row) => String(row.user)));

  const operations = users
    .filter((user) => !existingSet.has(String(user._id)))
    .map((user) => {
      const quote = getQuoteForRole(user.role, quoteDate);
      return {
        insertOne: {
          document: {
            title: "Daily Medical Quote",
            body: quote.text,
            category: "WELLNESS",
            user: user._id,
            hospital: user.hospital || null,
            read: false,
            meta: {
              kind: "DAILY_ROLE_QUOTE",
              quoteDate,
              quoteRole: quote.role,
              quoteKey: quote.key,
              path: quote.path,
            },
          },
        },
      };
    });

  if (operations.length) {
    await Notification.bulkWrite(operations, { ordered: false });
  }

  return {
    scanned: users.length,
    created: operations.length,
    quoteDate,
  };
}
