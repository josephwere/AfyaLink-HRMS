// frontend/src/pages/Profile.jsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../utils/auth";
import apiFetch from "../utils/apiFetch";
import { useNavigate } from "react-router-dom";
import { redirectByRole } from "../utils/redirectByRole";
import CountryPhoneInput, { toE164 } from "../components/CountryPhoneInput";
import { getCountryOptions, splitDialAndLocal } from "../utils/countryDialCodes";
import {
  applyAccessibilityPrefs,
  getDefaultAccessibilityPrefs,
  loadAccessibilityPrefs,
  saveAccessibilityPrefs,
} from "../utils/accessibilityPrefs";

const COOLDOWN_KEY = "verifyCooldownUntil";

function DismissibleSection({ sectionKey, title, open, onClose, onOpen, children, className = "" }) {
  return (
    <div className={`card profile-card dismissible-section ${className}`.trim()}>
      <div className="dismissible-head">
        <h3>{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default function Profile() {
  const {
    user,
    canRoleOverride,
    roleOverride,
    strictImpersonation,
    setRoleOverride,
    setStrictImpersonation,
  } = useAuth();
  const navigate = useNavigate();
  const [viewRole, setViewRole] = useState("");

  const viewableRoles = [
    "SUPER_ADMIN",
    "SYSTEM_ADMIN",
    "HOSPITAL_ADMIN",
    "HOSPITAL_ADMIN_ASSISTANT",
    "DEVELOPER",
    "DOCTOR",
    "SURGEON",
    "NURSE",
    "LAB_TECH",
    "PHARMACIST",
    "RADIOLOGIST",
    "THERAPIST",
    "RECEPTIONIST",
    "SECURITY_OFFICER",
    "SECURITY_ADMIN",
    "HR_MANAGER",
    "PAYROLL_OFFICER",
    "COMMUNITY_HEALTH_WORKER",
    "PATIENT",
    "GUEST",
  ];

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 2FA
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [twoFAMethod, setTwoFAMethod] = useState("OTP");
  const [totpSecret, setTotpSecret] = useState("");
  const [totpUrl, setTotpUrl] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [twoFAMsg, setTwoFAMsg] = useState("");
  const [twoFABusy, setTwoFABusy] = useState(false);

  // Email verification
  const [emailVerified, setEmailVerified] = useState(true);
  const [verificationWarning, setVerificationWarning] = useState(null);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [cooldown, setCooldown] = useState(0);

  // Phone verification + national ID
  const [phoneCountry, setPhoneCountry] = useState("");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState("");
  const [phoneMsg, setPhoneMsg] = useState("");
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [idNumber, setIdNumber] = useState("");
  const [idCountry, setIdCountry] = useState("");
  const [idSaving, setIdSaving] = useState(false);
  const [idMsg, setIdMsg] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseExpiry, setLicenseExpiry] = useState("");
  const [licenseSaving, setLicenseSaving] = useState(false);
  const [licenseMsg, setLicenseMsg] = useState("");
  const [extendedSaving, setExtendedSaving] = useState(false);
  const [extendedMsg, setExtendedMsg] = useState("");

  // Global production profile fields
  const [basic, setBasic] = useState({
    gender: "",
    dateOfBirth: "",
    nationality: "",
    address: "",
    emergencyName: "",
    emergencyRelationship: "",
    emergencyPhone: "",
  });
  const countries = useMemo(() => getCountryOptions(), []);
  const [employment, setEmployment] = useState({
    employeeId: "",
    department: "",
    reportingManager: "",
    employmentType: "",
    hireDate: "",
    contractStart: "",
    contractEnd: "",
    workLocation: "",
    branch: "",
  });
  const [credentials, setCredentials] = useState({
    specialization: "",
    subSpecialization: "",
    cmeCredits: "",
    researchPublications: "",
    testAuthorizationLevel: "",
    certifications: "",
    educationHistory: "",
  });
  const [financial, setFinancial] = useState({
    bankName: "",
    bankAccountName: "",
    bankAccountNumber: "",
    bankBranch: "",
    taxId: "",
    pensionInfo: "",
    salaryStructure: "",
    allowances: "",
    deductions: "",
  });
  const [systemProfile, setSystemProfile] = useState({
    status: "ACTIVE",
    accessExpiresAt: "",
  });
  const [insurance, setInsurance] = useState({
    providerCode: "",
    providerName: "",
    memberNumber: "",
    balance: "",
    currency: "KES",
    status: "PENDING",
  });

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMessage, setPwMessage] = useState("");
  const [pwError, setPwError] = useState("");
  const [a11yPrefs, setA11yPrefs] = useState(getDefaultAccessibilityPrefs());
  const [openSections, setOpenSections] = useState({
    roleSwitcher: false,
    verificationStatus: false,
    phoneNationalId: false,
    basicInfo: false,
    employmentInfo: false,
    credentialsInfo: false,
    financialInfo: false,
    insuranceProfile: false,
    systemData: false,
    roleChecklist: false,
    trainingGuide: false,
    twoFactor: false,
    password: false,
    accessibility: false,
  });
  const [trainingRole, setTrainingRole] = useState("");
  const [trainingMsg, setTrainingMsg] = useState("");
  const [trainingView, setTrainingView] = useState("FULL");

  const closeSection = (sectionKey) =>
    setOpenSections((prev) => ({ ...prev, [sectionKey]: false }));
  const openSection = (sectionKey) =>
    setOpenSections((prev) => ({ ...prev, [sectionKey]: true }));

  useEffect(() => {
    restoreCooldown();
    loadStatus();
  }, []);

  useEffect(() => {
    setViewRole(roleOverride || user?.actualRole || user?.role || "");
  }, [roleOverride, user?.actualRole, user?.role]);

  useEffect(() => {
    if (!trainingRole && user?.role) setTrainingRole(user.role);
  }, [trainingRole, user?.role]);

  useEffect(() => {
    if (!user) return;
    const prefs = loadAccessibilityPrefs(user);
    setA11yPrefs(prefs);
    applyAccessibilityPrefs(prefs);
  }, [user]);

  /* -------------------------
     Restore resend cooldown
  -------------------------- */
  const restoreCooldown = () => {
    const until = Number(localStorage.getItem(COOLDOWN_KEY));
    if (!until) return;

    const remaining = Math.ceil((until - Date.now()) / 1000);
    if (remaining > 0) setCooldown(remaining);
    else localStorage.removeItem(COOLDOWN_KEY);
  };

  /* -------------------------
     Cooldown timer
  -------------------------- */
  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          localStorage.removeItem(COOLDOWN_KEY);
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldown]);

  /* -------------------------
     Load 2FA + email status
  -------------------------- */
  const loadStatus = async () => {
    try {
      const data2FA = await apiFetch("/api/2fa/status");
      setTwoFAEnabled(Boolean(data2FA?.enabled));
      setTwoFAMethod(data2FA?.method || "OTP");

      const me = await apiFetch("/api/profile");
      setEmailVerified(Boolean(me?.emailVerified));
      setPhoneVerified(Boolean(me?.phoneVerified));
      const parsedPhone = splitDialAndLocal(me?.phone || "");
      setPhoneCountry(parsedPhone.countryCode || "");
      setPhoneLocal(parsedPhone.local || "");
      setIdNumber(me?.nationalIdNumber || "");
      setIdCountry(me?.nationalIdCountry || "");
      setLicenseNumber(me?.licenseNumber || "");
      setLicenseExpiry(me?.licenseExpiry ? me.licenseExpiry.slice(0, 10) : "");
      setVerificationWarning(me?.verificationWarning || null);
      setBasic({
        gender: me?.gender || "",
        dateOfBirth: me?.dateOfBirth ? me.dateOfBirth.slice(0, 10) : "",
        nationality: me?.nationality || "",
        address: me?.address || "",
        emergencyName: me?.emergencyContact?.name || "",
        emergencyRelationship: me?.emergencyContact?.relationship || "",
        emergencyPhone: me?.emergencyContact?.phone || "",
      });
      setEmployment({
        employeeId: me?.employment?.employeeId || "",
        department: me?.employment?.department || "",
        reportingManager: me?.employment?.reportingManager || "",
        employmentType: me?.employment?.employmentType || "",
        hireDate: me?.employment?.hireDate ? me.employment.hireDate.slice(0, 10) : "",
        contractStart: me?.employment?.contractStart ? me.employment.contractStart.slice(0, 10) : "",
        contractEnd: me?.employment?.contractEnd ? me.employment.contractEnd.slice(0, 10) : "",
        workLocation: me?.employment?.workLocation || "",
        branch: me?.employment?.branch || "",
      });
      setCredentials({
        specialization: me?.credentials?.specialization || "",
        subSpecialization: me?.credentials?.subSpecialization || "",
        cmeCredits: me?.credentials?.cmeCredits ?? "",
        researchPublications: me?.credentials?.researchPublications ?? "",
        testAuthorizationLevel: me?.credentials?.testAuthorizationLevel || "",
        certifications: (me?.credentials?.certifications || []).join(", "),
        educationHistory: (me?.credentials?.educationHistory || []).join(", "),
      });
      setFinancial({
        bankName: me?.financial?.bankName || "",
        bankAccountName: me?.financial?.bankAccountName || "",
        bankAccountNumber: me?.financial?.bankAccountNumber || "",
        bankBranch: me?.financial?.bankBranch || "",
        taxId: me?.financial?.taxId || "",
        pensionInfo: me?.financial?.pensionInfo || "",
        salaryStructure: me?.financial?.salaryStructure || "",
        allowances: me?.financial?.allowances ?? "",
        deductions: me?.financial?.deductions ?? "",
      });
      setSystemProfile({
        status: me?.systemProfile?.status || "ACTIVE",
        accessExpiresAt: me?.systemProfile?.accessExpiresAt
          ? me.systemProfile.accessExpiresAt.slice(0, 10)
          : "",
      });
      setInsurance({
        providerCode: me?.insuranceProfile?.providerCode || "",
        providerName: me?.insuranceProfile?.providerName || "",
        memberNumber: me?.insuranceProfile?.memberNumber || "",
        balance:
          me?.insuranceProfile?.balance === null || me?.insuranceProfile?.balance === undefined
            ? ""
            : String(me.insuranceProfile.balance),
        currency: me?.insuranceProfile?.currency || "KES",
        status: me?.insuranceProfile?.status || "PENDING",
      });
    } catch {
      setError("Unable to load security settings");
    } finally {
      setLoading(false);
    }
  };

  const saveExtendedProfile = async () => {
    setExtendedSaving(true);
    setExtendedMsg("");
    try {
      await apiFetch("/api/profile", {
        method: "PUT",
        body: {
          gender: basic.gender || undefined,
          dateOfBirth: basic.dateOfBirth || undefined,
          nationality: basic.nationality || undefined,
          address: basic.address || undefined,
          emergencyContact: {
            name: basic.emergencyName || undefined,
            relationship: basic.emergencyRelationship || undefined,
            phone: basic.emergencyPhone || undefined,
          },
          employment: {
            employeeId: employment.employeeId || undefined,
            department: employment.department || undefined,
            reportingManager: employment.reportingManager || undefined,
            employmentType: employment.employmentType || undefined,
            hireDate: employment.hireDate || undefined,
            contractStart: employment.contractStart || undefined,
            contractEnd: employment.contractEnd || undefined,
            workLocation: employment.workLocation || undefined,
            branch: employment.branch || undefined,
          },
          credentials: {
            specialization: credentials.specialization || undefined,
            subSpecialization: credentials.subSpecialization || undefined,
            cmeCredits: credentials.cmeCredits === "" ? undefined : Number(credentials.cmeCredits),
            researchPublications:
              credentials.researchPublications === ""
                ? undefined
                : Number(credentials.researchPublications),
            testAuthorizationLevel: credentials.testAuthorizationLevel || undefined,
            certifications: credentials.certifications
              ? credentials.certifications.split(",").map((s) => s.trim()).filter(Boolean)
              : [],
            educationHistory: credentials.educationHistory
              ? credentials.educationHistory.split(",").map((s) => s.trim()).filter(Boolean)
              : [],
          },
          financial: {
            bankName: financial.bankName || undefined,
            bankAccountName: financial.bankAccountName || undefined,
            bankAccountNumber: financial.bankAccountNumber || undefined,
            bankBranch: financial.bankBranch || undefined,
            taxId: financial.taxId || undefined,
            pensionInfo: financial.pensionInfo || undefined,
            salaryStructure: financial.salaryStructure || undefined,
            allowances: financial.allowances === "" ? undefined : Number(financial.allowances),
            deductions: financial.deductions === "" ? undefined : Number(financial.deductions),
          },
          systemProfile: {
            status: systemProfile.status || undefined,
            accessExpiresAt: systemProfile.accessExpiresAt || undefined,
          },
          insuranceProfile: {
            providerCode: insurance.providerCode || undefined,
            providerName: insurance.providerName || undefined,
            memberNumber: insurance.memberNumber || undefined,
            balance: insurance.balance === "" ? undefined : Number(insurance.balance),
            currency: insurance.currency || undefined,
            status: insurance.status || undefined,
          },
        },
      });
      setExtendedMsg("Profile details updated.");
    } catch (err) {
      setExtendedMsg(err.message || "Failed to update profile details");
    } finally {
      setExtendedSaving(false);
    }
  };

  const updateA11yPref = (field, value) => {
    const next = { ...a11yPrefs, [field]: value };
    setA11yPrefs(next);
    saveAccessibilityPrefs(user, next);
    applyAccessibilityPrefs(next);
  };

  const resetA11yPrefs = () => {
    const defaults = getDefaultAccessibilityPrefs();
    setA11yPrefs(defaults);
    saveAccessibilityPrefs(user, defaults);
    applyAccessibilityPrefs(defaults);
  };

  /* -------------------------
     Toggle 2FA
  -------------------------- */
  const toggle2FA = async () => {
    try {
      const next = !twoFAEnabled;
      await apiFetch("/api/2fa/toggle", {
        method: "POST",
        body: { enabled: next },
      });
      setTwoFAEnabled(next);
      setTwoFAMethod(next ? "OTP" : "OTP");
      setTwoFAMsg(next ? "OTP 2FA enabled." : "2FA disabled.");
    } catch {
      setError("Failed to update 2FA setting");
    }
  };

  const setupTotp = async () => {
    setTwoFABusy(true);
    setTwoFAMsg("");
    try {
      const data = await apiFetch("/api/2fa/setup-totp", { method: "POST" });
      setTotpSecret(data?.secret || "");
      setTotpUrl(data?.otpauthUrl || "");
      setRecoveryCodes([]);
      setTwoFAMsg("Scan the secret in Google Authenticator, then verify code.");
    } catch (err) {
      setTwoFAMsg(err.message || "Failed to initialize authenticator setup");
    } finally {
      setTwoFABusy(false);
    }
  };

  const verifyTotp = async () => {
    if (!totpCode.trim()) return;
    setTwoFABusy(true);
    setTwoFAMsg("");
    try {
      const data = await apiFetch("/api/2fa/verify-totp", {
        method: "POST",
        body: { code: totpCode.trim() },
      });
      setTwoFAEnabled(Boolean(data?.enabled));
      setTwoFAMethod(data?.method || "TOTP");
      setRecoveryCodes(Array.isArray(data?.recoveryCodes) ? data.recoveryCodes : []);
      setTotpCode("");
      setTwoFAMsg("Authenticator 2FA enabled.");
    } catch (err) {
      setTwoFAMsg(err.message || "Failed to verify authenticator code");
    } finally {
      setTwoFABusy(false);
    }
  };

  const disableTotp = async () => {
    if (!totpCode.trim()) return;
    setTwoFABusy(true);
    setTwoFAMsg("");
    try {
      await apiFetch("/api/2fa/disable", {
        method: "POST",
        body: { code: totpCode.trim() },
      });
      setTwoFAEnabled(false);
      setTwoFAMethod("OTP");
      setTotpSecret("");
      setTotpUrl("");
      setRecoveryCodes([]);
      setTotpCode("");
      setTwoFAMsg("Authenticator 2FA disabled.");
    } catch (err) {
      setTwoFAMsg(err.message || "Failed to disable authenticator 2FA");
    } finally {
      setTwoFABusy(false);
    }
  };

  /* -------------------------
     Resend email verification
  -------------------------- */
  const resendVerification = async () => {
    try {
      setSending(true);
      setMessage("");
      const data = await apiFetch("/api/auth/resend-verification", {
        method: "POST",
        body: { email: user?.email },
      });
      const seconds = data?.retryAfter || 60;
      localStorage.setItem(COOLDOWN_KEY, Date.now() + seconds * 1000);
      setCooldown(seconds);

      setMessage("📩 Verification email sent. Check your inbox.");
    } catch {
      setMessage("❌ Failed to send verification email");
    } finally {
      setSending(false);
    }
  };

  /* -------------------------
     Render verification warning
  -------------------------- */
  const renderVerificationWarning = () => {
    if (emailVerified || phoneVerified || !verificationWarning) return null;

    const map = {
      "14d": "Your profile will be deleted in 14 days.",
      "3d": "Your profile will be deleted in 3 days.",
      "2h": "Your profile will be deleted in 2 hours.",
      EXPIRED: "Your account has expired and will be deleted.",
    };

    return (
      <div className="card warning-card">
        <h3>⚠️ Verification Required</h3>
        <p>{map[verificationWarning.type]}</p>

        {verificationWarning.type !== "EXPIRED" && user?.email && (
          <button
            type="button"
            className="primary"
            disabled={sending || cooldown > 0}
            onClick={resendVerification}
          >
            {sending
              ? "Sending..."
              : cooldown > 0
              ? `Resend in ${cooldown}s`
              : "Verify Account"}
          </button>
        )}

        {message && <p style={{ marginTop: 8 }}>{message}</p>}
      </div>
    );
  };

  /* -------------------------
     Update national ID
  -------------------------- */
  const saveNationalId = async () => {
    setIdSaving(true);
    setIdMsg("");
    try {
      await apiFetch("/api/profile", {
        method: "PUT",
        body: {
          nationalIdNumber: idNumber || undefined,
          nationalIdCountry: idCountry || undefined,
        },
      });
      setIdMsg("National ID updated");
    } catch (err) {
      setIdMsg(err.message || "Failed to update National ID");
    } finally {
      setIdSaving(false);
    }
  };

  /* -------------------------
     Update license
  -------------------------- */
  const saveLicense = async () => {
    setLicenseSaving(true);
    setLicenseMsg("");
    try {
      await apiFetch("/api/profile", {
        method: "PUT",
        body: {
          licenseNumber: licenseNumber || undefined,
          licenseExpiry: licenseExpiry || undefined,
        },
      });
      setLicenseMsg("License updated");
    } catch (err) {
      setLicenseMsg(err.message || "Failed to update license");
    } finally {
      setLicenseSaving(false);
    }
  };

  /* -------------------------
     Phone OTP flow
  -------------------------- */
  const requestPhoneOtp = async () => {
    setPhoneBusy(true);
    setPhoneMsg("");
    try {
      const formattedPhone = toE164(phoneCountry, phoneLocal);
      await apiFetch("/api/auth/phone/request-otp", {
        method: "POST",
        body: { phone: formattedPhone || undefined },
      });
      setPhoneVerified(false);
      setPhoneMsg("OTP sent to your phone.");
    } catch (err) {
      setPhoneMsg(err.message || "Failed to send OTP");
    } finally {
      setPhoneBusy(false);
    }
  };

  const verifyPhoneOtp = async () => {
    setPhoneBusy(true);
    setPhoneMsg("");
    try {
      await apiFetch("/api/auth/phone/verify", {
        method: "POST",
        body: { otp: phoneOtp.trim() },
      });
      setPhoneVerified(true);
      setPhoneOtp("");
      setPhoneMsg("Phone verified successfully.");
    } catch (err) {
      setPhoneMsg(err.message || "Invalid OTP");
    } finally {
      setPhoneBusy(false);
    }
  };

  /* -------------------------
     Change password
  -------------------------- */
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwMessage("");
    setPwError("");

    if (newPassword !== confirmPassword) {
      setPwError("Passwords do not match");
      return;
    }

    setPwLoading(true);

    try {
      const data = await apiFetch("/api/auth/change-password", {
        method: "POST",
        body: { currentPassword, newPassword },
      });

      setPwMessage("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPwError(err.message || "Password change failed");
    } finally {
      setPwLoading(false);
    }
  };

  const roleProfileHints = {
    SUPER_ADMIN: [
      "System configuration and permission matrix ownership",
      "API key management and integration governance",
      "Global audit and backup oversight",
    ],
    SYSTEM_ADMIN: [
      "Server operations and error diagnostics",
      "Database and feature-toggle control",
      "Integration reliability monitoring",
    ],
    HOSPITAL_ADMIN: [
      "Department and staffing operations",
      "Shift, leave and approval oversight",
      "Budget and branch execution control",
    ],
    SECURITY_ADMIN: [
      "Incident escalation and clearance governance",
      "Visitor and surveillance compliance management",
      "Emergency response coordination",
    ],
    SECURITY_OFFICER: [
      "Shift assignment and gate operations",
      "Visitor verification and QR scanning",
      "Incident reporting execution",
    ],
    HR_MANAGER: [
      "Recruitment and onboarding workflows",
      "Performance and disciplinary tracking",
      "Training and succession planning",
    ],
    PAYROLL_OFFICER: [
      "Payroll processing and payslip generation",
      "Tax, pension, deductions and audit trail",
      "Overtime and shift differential reconciliation",
    ],
    COMMUNITY_HEALTH_WORKER: [
      "Household outreach, maternal/child follow-up, and vaccination tracking",
      "Disease surveillance and referral escalation to hospital teams",
      "Offline-first field data capture with auto-sync when back online",
    ],
    DEVELOPER: [
      "API logs, webhook diagnostics and feature flags",
      "Performance tracing and release validation",
      "Integration and automation reliability",
    ],
    DOCTOR: [
      "Medical license and specialization details",
      "Clinical schedule and patient workload context",
      "CME credits and publications tracking",
    ],
    SURGEON: [
      "Surgery privileges, theatre assignment, and specialization profile",
      "Pre-op and post-op workflow accountability",
      "Clinical readiness, licensing, and emergency on-call context",
    ],
    NURSE: [
      "Ward/department assignment and shift readiness",
      "Clinical workload and overtime visibility",
      "Incident and quality reporting continuity",
    ],
    LAB_TECH: [
      "Test authorization level and assignment scope",
      "Lab workflow accountability and compliance",
      "Safety and equipment audit readiness",
    ],
    PHARMACIST: [
      "License and controlled-drug accountability",
      "Inventory and dispensing governance",
      "Expiry and interaction safety controls",
    ],
    PATIENT: [
      "Verified identity and emergency contact",
      "Clinical and billing communication readiness",
      "Secure self-service profile completeness",
    ],
    GUEST: [
      "Pre-registration and contact readiness",
      "Limited-access appointment flow data",
      "Upgrade eligibility details",
    ],
    RADIOLOGIST: [
      "Imaging authorization and reporting scope",
      "Diagnostic workflow credential completeness",
      "PACS and compliance readiness",
    ],
    THERAPIST: [
      "Treatment plan and session documentation profile",
      "Progress tracking role context",
      "Department and scheduling completeness",
    ],
    RECEPTIONIST: [
      "Patient intake and scheduling role context",
      "Queue and billing initiation responsibility",
      "Front-desk operational readiness",
    ],
  };

  const roleTrainingGuides = {
    SUPER_ADMIN: {
      goal: "Own platform governance, uptime, compliance, and cross-hospital strategy.",
      firstHour: [
        "Open Super Admin Dashboard and verify hospitals, staff, and patient totals.",
        "Review system health, security incidents, and audit stream.",
        "Check subscription/trial state and premium feature access by hospital.",
      ],
      daily: [
        "Review critical alerts and unresolved escalations first.",
        "Approve high-risk access changes and policy overrides.",
        "Validate backup status and integration error budget.",
      ],
      safety: [
        "Never share founder/super-admin credentials.",
        "Use audit logs before and after sensitive changes.",
      ],
      kpi: ["System uptime", "Critical incident MTTR", "Compliance pass rate"],
    },
    SYSTEM_ADMIN: {
      goal: "Run technical operations and platform reliability safely.",
      firstHour: [
        "Check API errors, queue health, and failed jobs.",
        "Validate environment config and integration connectors.",
        "Confirm role overrides and feature flags are correct.",
      ],
      daily: [
        "Clear DLQ backlog with controlled replay.",
        "Review connector retries and mapping failures.",
        "Monitor infrastructure alarms and service latency.",
      ],
      safety: [
        "Change one feature flag at a time with rollback path.",
        "Document all production changes in runbook.",
      ],
      kpi: ["Error rate", "Queue backlog", "Mean recovery time"],
    },
    HOSPITAL_ADMIN: {
      goal: "Run one hospital branch end-to-end across workforce and operations.",
      firstHour: [
        "Review staff coverage, pending approvals, and incident alerts.",
        "Check machine connectivity and offline sync status.",
        "Confirm finance, insurance, and patient operations readiness.",
      ],
      daily: [
        "Approve/reject workforce requests with SLA discipline.",
        "Track recruitment ads and applicant pipeline.",
        "Resolve branch bottlenecks (labs, pharmacy, beds, queue).",
      ],
      safety: [
        "Assign least privilege to staff roles.",
        "Require reason on high-severity actions.",
      ],
      kpi: ["Approval SLA", "Staff coverage", "Patient flow delay"],
    },
    DEVELOPER: {
      goal: "Ship safe changes, debug production issues, and improve reliability.",
      firstHour: [
        "Open Developer Dashboard: logs, queue replay, webhook retry.",
        "Check release flags and current incidents.",
        "Validate migration and API compatibility status.",
      ],
      daily: [
        "Fix high-impact bugs first (auth, permissions, data integrity).",
        "Use action matrix to verify button->API->handler wiring.",
        "Publish change notes and regression evidence.",
      ],
      safety: [
        "Do not bypass audit or auth controls in production.",
        "Use staged rollout for risky changes.",
      ],
      kpi: ["Regression rate", "Bug fix lead time", "Deployment success rate"],
    },
    DOCTOR: {
      goal: "Deliver safe clinical care with complete documentation.",
      firstHour: [
        "Open schedule and prioritize urgent/critical patients.",
        "Review lab alerts and pending prescriptions.",
        "Complete consultation notes and referrals.",
      ],
      daily: [
        "Update diagnoses, treatment plans, and follow-up dates.",
        "Close pending chart tasks before shift end.",
        "Review performance and compliance reminders.",
      ],
      safety: [
        "Sign orders only after verification.",
        "Use handover notes for continuity.",
      ],
      kpi: ["Consultation completion", "Turnaround time", "Clinical documentation quality"],
    },
    SURGEON: {
      goal: "Deliver safe surgical care from pre-op to post-op continuity.",
      firstHour: [
        "Review theatre schedule and urgent surgery queue.",
        "Confirm pre-op readiness and required diagnostics.",
        "Check active encounters requiring immediate intervention.",
      ],
      daily: [
        "Complete operative notes and post-op orders promptly.",
        "Coordinate with anaesthesia, nursing, and lab/radiology teams.",
        "Track complications and escalation handoffs with clear documentation.",
      ],
      safety: [
        "Use checklist-driven verification before every procedure.",
        "Document consent and surgical findings with full traceability.",
      ],
      kpi: ["On-time surgery start", "Post-op documentation completion", "Complication escalation time"],
    },
    NURSE: {
      goal: "Execute bedside workflow, vitals, meds, and incident escalation.",
      firstHour: [
        "Check shift board and assigned patients.",
        "Review medication due list and critical alerts.",
        "Start vitals and nursing notes updates.",
      ],
      daily: [
        "Record medication administration on time.",
        "Escalate abnormal findings immediately.",
        "Submit incident reports before handover.",
      ],
      safety: [
        "Use patient ID verification before meds.",
        "Document every exception.",
      ],
      kpi: ["Medication timeliness", "Vitals completion", "Incident response time"],
    },
    LAB_TECH: {
      goal: "Process tests accurately with quality and safety compliance.",
      firstHour: [
        "Open test queue and prioritize urgent samples.",
        "Check sample tracking and equipment status.",
        "Run quality and safety checks.",
      ],
      daily: [
        "Upload results and flag abnormal findings.",
        "Track delays and report blockers.",
        "Archive completed reports correctly.",
      ],
      safety: [
        "Follow biohazard and QC protocol strictly.",
        "Do not release unsigned/invalid results.",
      ],
      kpi: ["Test turnaround time", "QC pass rate", "Abnormal result escalation speed"],
    },
    PHARMACIST: {
      goal: "Dispense safely, maintain stock, and prevent interaction risks.",
      firstHour: [
        "Open prescription queue and prioritize urgent medications.",
        "Check low stock and expiry alerts.",
        "Verify controlled-drug logs.",
      ],
      daily: [
        "Dispense and record every issued medication.",
        "Resolve interaction warnings with prescriber.",
        "Update supplier orders for low stock.",
      ],
      safety: [
        "Require prescription verification before dispense.",
        "Track controlled drugs with full audit trail.",
      ],
      kpi: ["Dispense turnaround", "Stockout frequency", "Expiry loss rate"],
    },
    RADIOLOGIST: {
      goal: "Deliver accurate imaging interpretation and report turnaround.",
      firstHour: [
        "Open imaging queue and sort by urgency.",
        "Review pending reports and critical findings backlog.",
        "Confirm equipment readiness and PACS access.",
      ],
      daily: [
        "Publish signed reports with clear findings.",
        "Escalate critical results to clinician immediately.",
        "Maintain report quality consistency.",
      ],
      safety: [
        "Use verified patient identity on every study.",
        "Avoid unsigned draft release.",
      ],
      kpi: ["Report turnaround", "Critical result acknowledgment", "Report quality score"],
    },
    THERAPIST: {
      goal: "Run therapy sessions with measurable progress and continuity.",
      firstHour: [
        "Review daily sessions and high-risk follow-ups.",
        "Check treatment plans due for update.",
        "Prepare session goals and notes template.",
      ],
      daily: [
        "Document session outcomes and progress scores.",
        "Adjust treatment plans with care team alignment.",
        "Track missed sessions and rebooking.",
      ],
      safety: [
        "Document risks and escalation triggers.",
        "Maintain confidentiality in notes.",
      ],
      kpi: ["Session completion", "Progress adherence", "Follow-up retention"],
    },
    RECEPTIONIST: {
      goal: "Ensure fast front-desk flow: check-in, scheduling, and queue control.",
      firstHour: [
        "Open appointment board and pending check-ins.",
        "Validate walk-ins and registration queue.",
        "Coordinate with billing/security for access flow.",
      ],
      daily: [
        "Maintain accurate queue updates.",
        "Route patients to correct service points.",
        "Capture complete intake details.",
      ],
      safety: [
        "Verify identity before creating records.",
        "Escalate suspicious access cases.",
      ],
      kpi: ["Check-in time", "Queue accuracy", "No-show recovery rate"],
    },
    SECURITY_OFFICER: {
      goal: "Control physical access and respond to incidents quickly.",
      firstHour: [
        "Check assigned shift and zone.",
        "Open visitor check-in and gate scanner.",
        "Review active alerts and blacklist records.",
      ],
      daily: [
        "Log all visitor and access events.",
        "Submit incident reports with exact facts.",
        "Coordinate with receptionist/security admin.",
      ],
      safety: [
        "Never bypass verification workflow.",
        "Record timestamps and identities for evidence.",
      ],
      kpi: ["Access violation response time", "Incident closure rate", "Gate compliance"],
    },
    SECURITY_ADMIN: {
      goal: "Govern security policy, incidents, and investigation readiness.",
      firstHour: [
        "Review access logs and suspicious activities.",
        "Check open incidents and escalation status.",
        "Validate emergency protocol readiness.",
      ],
      daily: [
        "Approve/deny clearance requests.",
        "Audit device authorization and visitor controls.",
        "Prepare evidence trails for investigations.",
      ],
      safety: [
        "Preserve audit integrity and chain-of-custody.",
        "Apply least privilege in security controls.",
      ],
      kpi: ["Incident MTTR", "Unauthorized access attempts", "Audit completeness"],
    },
    HR_MANAGER: {
      goal: "Drive staffing lifecycle: recruit, onboard, performance, retention.",
      firstHour: [
        "Review open positions and pending leave requests.",
        "Check training/certification expiry alerts.",
        "Open workforce approvals and SLA queue.",
      ],
      daily: [
        "Advance recruitment pipeline and status changes.",
        "Complete onboarding/offboarding controls.",
        "Run performance and disciplinary review tasks.",
      ],
      safety: [
        "Use policy-based approvals with reason codes.",
        "Avoid out-of-policy role assignment.",
      ],
      kpi: ["Time-to-hire", "Approval SLA", "Turnover trend"],
    },
    PAYROLL_OFFICER: {
      goal: "Process accurate payroll with traceable deductions and taxes.",
      firstHour: [
        "Review pending overtime/shift adjustments.",
        "Validate deduction and allowance configuration.",
        "Check payroll exceptions and prior failures.",
      ],
      daily: [
        "Run payroll batches and verify totals.",
        "Generate payslips and reconcile anomalies.",
        "Close payroll with audit-ready trail.",
      ],
      safety: [
        "Never process payroll without reconciliation checks.",
        "Require dual-check for abnormal payouts.",
      ],
      kpi: ["Payroll accuracy", "Exception rate", "Cycle completion time"],
    },
    COMMUNITY_HEALTH_WORKER: {
      goal: "Connect hospital care to households with offline-first field workflows.",
      firstHour: [
        "Review daily visit plan and high-risk households.",
        "Check vaccination, maternal and chronic follow-up tasks.",
        "Confirm device sync/offline queue status.",
      ],
      daily: [
        "Record field visits and referrals on time.",
        "Report disease signals and urgent escalations.",
        "Sync offline records once online.",
      ],
      safety: [
        "Capture geo/time evidence for sensitive field actions.",
        "Escalate emergencies immediately to hospital team.",
      ],
      kpi: ["Visit completion", "Referral closure", "Sync success rate"],
    },
    PATIENT: {
      goal: "Use AfyaLink for appointments, records, labs, billing, and feedback.",
      firstHour: [
        "Select hospital, book appointment, and confirm doctor.",
        "Review medical records, prescriptions, and lab results.",
        "Check insurance/billing and payment options.",
      ],
      daily: [
        "Track appointment status and reminders.",
        "Review updates from care team.",
        "Submit feedback after service.",
      ],
      safety: [
        "Keep phone/email verified for account recovery.",
        "Use 2FA for account protection.",
      ],
      kpi: ["Appointment completion", "Profile completeness", "Feedback response rate"],
    },
    GUEST: {
      goal: "Access public services safely before full registration.",
      firstHour: [
        "Browse hospitals/services and pre-register correctly.",
        "Book appointment with valid contact details.",
        "Complete identity details when prompted.",
      ],
      daily: [
        "Track booking updates and conversion to patient profile.",
        "Keep contact details current for notifications.",
      ],
      safety: [
        "Use only verified channels for payments/booking.",
        "Upgrade to full account for protected services.",
      ],
      kpi: ["Booking success", "Conversion to patient", "Contact verification rate"],
    },
  };

  const resolvedTrainingRole = canRoleOverride
    ? trainingRole || viewRole || user?.role || "GUEST"
    : user?.role || "GUEST";
  const trainingGuide =
    roleTrainingGuides[resolvedTrainingRole] || roleTrainingGuides.GUEST;

  const weeklyTrainingPlan = [
    {
      day: "Day 1",
      title: "Orientation & Access",
      focus: [
        `Understand role goal: ${trainingGuide.goal}`,
        trainingGuide.firstHour?.[0] || "Review role dashboard and navigation.",
        "Confirm login, profile verification, and security setup.",
      ],
    },
    {
      day: "Day 2",
      title: "Core Workflow",
      focus: [
        trainingGuide.firstHour?.[1] || "Execute core workflow tasks.",
        trainingGuide.daily?.[0] || "Practice daily routine tasks.",
        "Complete 5 supervised tasks in live/staging flow.",
      ],
    },
    {
      day: "Day 3",
      title: "Safety & Compliance",
      focus: [
        trainingGuide.safety?.[0] || "Follow role safety controls.",
        "Review audit/accountability expectations.",
        "Run one incident/escalation simulation.",
      ],
    },
    {
      day: "Day 4",
      title: "Advanced Tasks",
      focus: [
        trainingGuide.firstHour?.[2] || "Handle advanced role scenarios.",
        trainingGuide.daily?.[1] || "Practice secondary daily tasks.",
        "Use analytics/alerts to prioritize work.",
      ],
    },
    {
      day: "Day 5",
      title: "Cross-Team Collaboration",
      focus: [
        trainingGuide.daily?.[2] || "Practice third-line routines.",
        "Use Communication Center for role-to-role handoffs.",
        "Close one end-to-end scenario with another department.",
      ],
    },
    {
      day: "Day 6",
      title: "Performance & KPIs",
      focus: [
        `Review role KPIs: ${(trainingGuide.kpi || []).join(", ")}`,
        "Identify top 2 bottlenecks and remediation actions.",
        "Run supervised quality review with trainer.",
      ],
    },
    {
      day: "Day 7",
      title: "Assessment & Sign-off",
      focus: [
        "Complete practical assessment checklist.",
        "Document SOP notes and escalation contacts.",
        "Trainer approval for independent operation.",
      ],
    },
  ];

  const buildTrainingLines = () => [
    `AfyaLink Training Notes - ${resolvedTrainingRole}`,
    `Goal: ${trainingGuide.goal}`,
    "",
    "First Hour",
    ...(trainingGuide.firstHour || []).map((x) => `- ${x}`),
    "",
    "Daily Routine",
    ...(trainingGuide.daily || []).map((x) => `- ${x}`),
    "",
    "Safety Rules",
    ...(trainingGuide.safety || []).map((x) => `- ${x}`),
    "",
    "Key Metrics",
    ...(trainingGuide.kpi || []).map((x) => `- ${x}`),
    "",
    "7-Day Onboarding Plan",
    ...weeklyTrainingPlan.flatMap((w) => [
      `${w.day}: ${w.title}`,
      ...w.focus.map((x) => `- ${x}`),
      "",
    ]),
  ];

  const buildMasterTrainingLines = () => {
    const lines = [
      "AfyaLink Role Training Playbook (All Roles)",
      "",
      "7-Day Onboarding Template",
      "- Day 1: Orientation, role scope, login/profile/security setup, dashboard navigation.",
      "- Day 2: Core workflow execution with supervision.",
      "- Day 3: Safety, compliance, incident/escalation simulation.",
      "- Day 4: Advanced tasks and edge-case handling.",
      "- Day 5: Cross-team communication and handoff scenarios.",
      "- Day 6: KPI review, quality checks, remediation planning.",
      "- Day 7: Practical assessment, SOP sign-off, go-live readiness.",
      "",
    ];

    viewableRoles.forEach((role) => {
      const guide = roleTrainingGuides[role] || roleTrainingGuides.GUEST;
      lines.push(`=== ${role} ===`);
      lines.push(`Goal: ${guide.goal || "N/A"}`);
      lines.push("First Hour:");
      (guide.firstHour || []).forEach((item) => lines.push(`- ${item}`));
      lines.push("Daily Routine:");
      (guide.daily || []).forEach((item) => lines.push(`- ${item}`));
      lines.push("Safety Rules:");
      (guide.safety || []).forEach((item) => lines.push(`- ${item}`));
      lines.push("Key Metrics:");
      (guide.kpi || []).forEach((item) => lines.push(`- ${item}`));
      lines.push("");
    });

    return lines;
  };

  const copyTrainingNotes = async () => {
    const lines = buildTrainingLines();
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setTrainingMsg("Training notes copied.");
    } catch {
      setTrainingMsg("Failed to copy notes. Please copy manually.");
    }
  };

  const downloadTrainingNotes = () => {
    try {
      const blob = new Blob([buildTrainingLines().join("\n")], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `afyalink-training-${String(resolvedTrainingRole || "role").toLowerCase()}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setTrainingMsg("Training notes downloaded.");
    } catch {
      setTrainingMsg("Failed to download notes.");
    }
  };

  const copyMasterTrainingNotes = async () => {
    try {
      await navigator.clipboard.writeText(buildMasterTrainingLines().join("\n"));
      setTrainingMsg("Full role playbook copied.");
    } catch {
      setTrainingMsg("Failed to copy full playbook.");
    }
  };

  const downloadMasterTrainingNotes = () => {
    try {
      const blob = new Blob([buildMasterTrainingLines().join("\n")], {
        type: "text/plain;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "afyalink-role-training-playbook.txt";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setTrainingMsg("Full role playbook downloaded.");
    } catch {
      setTrainingMsg("Failed to download full playbook.");
    }
  };

  const printTrainingNotes = () => {
    try {
      const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>AfyaLink Training - ${resolvedTrainingRole}</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.5; padding: 20px; color: #111; }
    h1 { font-size: 20px; margin-bottom: 8px; }
    h2 { font-size: 16px; margin: 14px 0 6px; }
    ul { margin: 0 0 10px 18px; }
  </style>
</head>
<body>
  <h1>AfyaLink Training Notes - ${resolvedTrainingRole}</h1>
  <p><strong>Goal:</strong> ${trainingGuide.goal}</p>
  <h2>First Hour</h2>
  <ul>${(trainingGuide.firstHour || []).map((x) => `<li>${x}</li>`).join("")}</ul>
  <h2>Daily Routine</h2>
  <ul>${(trainingGuide.daily || []).map((x) => `<li>${x}</li>`).join("")}</ul>
  <h2>Safety Rules</h2>
  <ul>${(trainingGuide.safety || []).map((x) => `<li>${x}</li>`).join("")}</ul>
  <h2>Key Metrics</h2>
  <ul>${(trainingGuide.kpi || []).map((x) => `<li>${x}</li>`).join("")}</ul>
  <h2>7-Day Onboarding Plan</h2>
  ${weeklyTrainingPlan
    .map(
      (w) => `
  <h3>${w.day}: ${w.title}</h3>
  <ul>${w.focus.map((x) => `<li>${x}</li>`).join("")}</ul>`
    )
    .join("")}
</body>
</html>`;
      const w = window.open("", "_blank");
      if (!w) {
        setTrainingMsg("Pop-up blocked. Allow pop-ups to print.");
        return;
      }
      w.document.open();
      w.document.write(html);
      w.document.close();
      w.focus();
      w.print();
      setTrainingMsg("Print window opened.");
    } catch {
      setTrainingMsg("Failed to open print view.");
    }
  };

  const printMasterTrainingNotes = () => {
    try {
      const htmlSections = viewableRoles
        .map((role) => {
          const guide = roleTrainingGuides[role] || roleTrainingGuides.GUEST;
          return `
            <h2>${role}</h2>
            <p><strong>Goal:</strong> ${guide.goal || ""}</p>
            <h3>First Hour</h3>
            <ul>${(guide.firstHour || []).map((x) => `<li>${x}</li>`).join("")}</ul>
            <h3>Daily Routine</h3>
            <ul>${(guide.daily || []).map((x) => `<li>${x}</li>`).join("")}</ul>
            <h3>Safety Rules</h3>
            <ul>${(guide.safety || []).map((x) => `<li>${x}</li>`).join("")}</ul>
            <h3>Key Metrics</h3>
            <ul>${(guide.kpi || []).map((x) => `<li>${x}</li>`).join("")}</ul>
          `;
        })
        .join("");

      const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>AfyaLink Role Training Playbook</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.5; padding: 20px; color: #111; }
    h1 { font-size: 22px; margin-bottom: 8px; }
    h2 { font-size: 18px; margin: 18px 0 6px; border-top: 1px solid #ddd; padding-top: 12px; }
    h3 { font-size: 14px; margin: 10px 0 4px; }
    ul { margin: 0 0 10px 18px; }
  </style>
</head>
<body>
  <h1>AfyaLink Role Training Playbook</h1>
  ${htmlSections}
</body>
</html>`;
      const w = window.open("", "_blank");
      if (!w) {
        setTrainingMsg("Pop-up blocked. Allow pop-ups to print.");
        return;
      }
      w.document.open();
      w.document.write(html);
      w.document.close();
      w.focus();
      w.print();
      setTrainingMsg("Full role playbook print opened.");
    } catch {
      setTrainingMsg("Failed to open full playbook print view.");
    }
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div className="profile-container">
      {canRoleOverride && (
        <DismissibleSection
          sectionKey="roleSwitcher"
          title="Role View Switcher"
          open={openSections.roleSwitcher}
          onClose={closeSection}
          onOpen={openSection}
          className="profile-hero-card"
        >
          <p className="muted">
            Use this to switch and test account types.
            Your actual account stays <strong>{user?.actualRole || user?.role}</strong>.
          </p>
          <label className="profile-inline-check" style={{ marginBottom: 12 }}>
            <input
              type="checkbox"
              checked={Boolean(strictImpersonation)}
              onChange={(e) => setStrictImpersonation(e.target.checked)}
            />
            <span>
              Lock to exact role permissions (strict impersonation)
            </span>
          </label>
          <p className="muted" style={{ marginTop: 0 }}>
            {strictImpersonation
              ? "Strict mode: access is limited to the switched role."
              : "Full access mode: founder/developer elevated permissions remain active while viewing another role."}
          </p>
          <div className="profile-row profile-actions-row">
            <select
              value={viewRole}
              onChange={(e) => setViewRole(e.target.value)}
            >
              {viewableRoles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <button type="button"
              className="primary"
              onClick={() => {
                setRoleOverride(viewRole);
                navigate(redirectByRole({ role: viewRole }));
              }}
            >
              Switch Role View
            </button>
            <button type="button"
              className="secondary"
              onClick={() => {
                const actual = user?.actualRole || user?.role;
                setRoleOverride("");
                setViewRole(actual);
                navigate(redirectByRole({ role: actual }));
              }}
            >
              Reset to My Role
            </button>
          </div>
        </DismissibleSection>
      )}

      {/* ============================
         EMAIL VERIFICATION
      ============================ */}
      {renderVerificationWarning()}

      <div className="profile-content-grid">
        {/* ============================
           VERIFICATION STATUS
        ============================ */}
        <DismissibleSection
          sectionKey="verificationStatus"
          title="Verification Status"
          open={openSections.verificationStatus}
          onClose={closeSection}
          onOpen={openSection}
        >
          <div className="profile-status-grid">
            <div className={`profile-status-pill ${emailVerified ? "ok" : "warn"}`}>
              <strong>Email:</strong> {emailVerified ? "Verified" : "Not verified"}
            </div>
            <div className={`profile-status-pill ${phoneVerified ? "ok" : "warn"}`}>
              <strong>Phone:</strong> {phoneVerified ? "Verified" : "Not verified"}
            </div>
          </div>
        </DismissibleSection>

        {/* ============================
           PHONE + NATIONAL ID
        ============================ */}
        <DismissibleSection
          sectionKey="phoneNationalId"
          title="Phone & National ID"
          open={openSections.phoneNationalId}
          onClose={closeSection}
          onOpen={openSection}
        >
          <p className="muted">
            {phoneVerified
              ? "Your phone number is verified."
              : "Verify your phone number to keep your account active."}
          </p>

          <CountryPhoneInput
            countryLabel="Phone country"
            phoneLabel="Phone number"
            countryCode={phoneCountry}
            localNumber={phoneLocal}
            onCountryCodeChange={setPhoneCountry}
            onLocalNumberChange={setPhoneLocal}
          />
          <div className="profile-row profile-actions-row">
            <button type="button"
              className="primary"
              onClick={requestPhoneOtp}
              disabled={phoneBusy || !(phoneLocal || "").trim()}
            >
              {phoneBusy ? "Sending..." : "Send OTP"}
            </button>

            <input
              value={phoneOtp}
              onChange={(e) => setPhoneOtp(e.target.value)}
              placeholder="Enter OTP"
              style={{ maxWidth: 220 }}
            />
            <button type="button"
              className="success"
              onClick={verifyPhoneOtp}
              disabled={phoneBusy || !phoneOtp.trim()}
            >
              {phoneBusy ? "Verifying..." : "Verify"}
            </button>
          </div>
          {phoneMsg && <p style={{ marginTop: 8 }}>{phoneMsg}</p>}

          <hr style={{ margin: "18px 0" }} />

          <label>National ID Number</label>
          <input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />

          <label>National ID Country</label>
          <select value={idCountry} onChange={(e) => setIdCountry(e.target.value)}>
            <option value="">Select country</option>
            {countries.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name} ({country.code})
              </option>
            ))}
          </select>
          <button type="button"
            className="primary"
            onClick={saveNationalId}
            disabled={idSaving}
            style={{ marginTop: 8 }}
          >
            {idSaving ? "Saving..." : "Save National ID"}
          </button>
          {idMsg && <p style={{ marginTop: 8 }}>{idMsg}</p>}

          <hr style={{ margin: "18px 0" }} />

          <label>Professional License Number</label>
          <input
            value={licenseNumber}
            onChange={(e) => setLicenseNumber(e.target.value)}
            placeholder="e.g. KMPDC-123456"
          />

          <label>License Expiry Date</label>
          <input
            type="date"
            value={licenseExpiry}
            onChange={(e) => setLicenseExpiry(e.target.value)}
          />

          <button type="button"
            className="primary"
            onClick={saveLicense}
            disabled={licenseSaving}
            style={{ marginTop: 8 }}
          >
            {licenseSaving ? "Saving..." : "Save License"}
          </button>
          {licenseMsg && <p style={{ marginTop: 8 }}>{licenseMsg}</p>}
        </DismissibleSection>

      <DismissibleSection
        sectionKey="accessibility"
        title="Display & Accessibility"
        open={openSections.accessibility}
        onClose={closeSection}
        onOpen={openSection}
      >
        <p className="muted">
          Adjust text and input size for better readability. Changes apply immediately across your account.
        </p>

        <label>Text size</label>
        <select
          value={a11yPrefs.textSize}
          onChange={(e) => updateA11yPref("textSize", e.target.value)}
        >
          <option value="small">Small</option>
          <option value="normal">Normal</option>
          <option value="large">Large</option>
          <option value="extra-large">Extra Large</option>
        </select>

        <label>Text spacing</label>
        <select
          value={a11yPrefs.textSpacing}
          onChange={(e) => updateA11yPref("textSpacing", e.target.value)}
        >
          <option value="compact">Compact</option>
          <option value="normal">Normal</option>
          <option value="relaxed">Relaxed</option>
        </select>

        <label>Input size</label>
        <select
          value={a11yPrefs.inputSize}
          onChange={(e) => updateA11yPref("inputSize", e.target.value)}
        >
          <option value="compact">Compact</option>
          <option value="normal">Normal</option>
          <option value="large">Large</option>
        </select>

        <div className="profile-row profile-actions-row">
          <button type="button" className="secondary" onClick={resetA11yPrefs}>
            Reset Display Defaults
          </button>
        </div>
      </DismissibleSection>

      <DismissibleSection
        sectionKey="basicInfo"
        title="Basic Information"
        open={openSections.basicInfo}
        onClose={closeSection}
        onOpen={openSection}
      >
        <label>Gender</label>
        <select
          value={basic.gender}
          onChange={(e) => setBasic({ ...basic, gender: e.target.value })}
        >
          <option value="">Select</option>
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
          <option value="OTHER">Other</option>
          <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
        </select>
        <label>Date of Birth</label>
        <input
          type="date"
          value={basic.dateOfBirth}
          onChange={(e) => setBasic({ ...basic, dateOfBirth: e.target.value })}
        />
        <label>Nationality</label>
        <select
          value={basic.nationality}
          onChange={(e) => setBasic({ ...basic, nationality: e.target.value })}
        >
          <option value="">Select country</option>
          {countries.map((country) => (
            <option key={country.code} value={country.code}>
              {country.name} ({country.code})
            </option>
          ))}
        </select>
        <label>Address</label>
        <input
          value={basic.address}
          onChange={(e) => setBasic({ ...basic, address: e.target.value })}
        />
        <label>Emergency Contact Name</label>
        <input
          value={basic.emergencyName}
          onChange={(e) => setBasic({ ...basic, emergencyName: e.target.value })}
        />
        <label>Emergency Contact Relationship</label>
        <input
          value={basic.emergencyRelationship}
          onChange={(e) =>
            setBasic({ ...basic, emergencyRelationship: e.target.value })
          }
        />
        <label>Emergency Contact Phone</label>
        <input
          value={basic.emergencyPhone}
          onChange={(e) => setBasic({ ...basic, emergencyPhone: e.target.value })}
        />
      </DismissibleSection>

      <DismissibleSection
        sectionKey="employmentInfo"
        title="Employment Information"
        open={openSections.employmentInfo}
        onClose={closeSection}
        onOpen={openSection}
      >
        
        <label>Employee ID</label>
        <input
          value={employment.employeeId}
          onChange={(e) => setEmployment({ ...employment, employeeId: e.target.value })}
        />
        <label>Department</label>
        <input
          value={employment.department}
          onChange={(e) => setEmployment({ ...employment, department: e.target.value })}
        />
        <label>Reporting Manager</label>
        <input
          value={employment.reportingManager}
          onChange={(e) =>
            setEmployment({ ...employment, reportingManager: e.target.value })
          }
        />
        <label>Employment Type</label>
        <select
          value={employment.employmentType}
          onChange={(e) =>
            setEmployment({ ...employment, employmentType: e.target.value })
          }
        >
          <option value="">Select</option>
          <option value="FULL_TIME">Full-time</option>
          <option value="LOCUM">Locum</option>
          <option value="CONTRACT">Contract</option>
          <option value="PART_TIME">Part-time</option>
          <option value="INTERN">Intern</option>
        </select>
        <label>Hire Date</label>
        <input
          type="date"
          value={employment.hireDate}
          onChange={(e) => setEmployment({ ...employment, hireDate: e.target.value })}
        />
        <label>Contract Start</label>
        <input
          type="date"
          value={employment.contractStart}
          onChange={(e) =>
            setEmployment({ ...employment, contractStart: e.target.value })
          }
        />
        <label>Contract End</label>
        <input
          type="date"
          value={employment.contractEnd}
          onChange={(e) => setEmployment({ ...employment, contractEnd: e.target.value })}
        />
        <label>Work Location</label>
        <input
          value={employment.workLocation}
          onChange={(e) => setEmployment({ ...employment, workLocation: e.target.value })}
        />
        <label>Branch</label>
        <input
          value={employment.branch}
          onChange={(e) => setEmployment({ ...employment, branch: e.target.value })}
        />
      </DismissibleSection>

      <DismissibleSection
        sectionKey="credentialsInfo"
        title="Credentials & Professional Data"
        open={openSections.credentialsInfo}
        onClose={closeSection}
        onOpen={openSection}
      >
        <label>Specialization</label>
        <input
          value={credentials.specialization}
          onChange={(e) =>
            setCredentials({ ...credentials, specialization: e.target.value })
          }
        />
        <label>Sub-specialization</label>
        <input
          value={credentials.subSpecialization}
          onChange={(e) =>
            setCredentials({ ...credentials, subSpecialization: e.target.value })
          }
        />
        <label>Certifications (comma-separated)</label>
        <input
          value={credentials.certifications}
          onChange={(e) =>
            setCredentials({ ...credentials, certifications: e.target.value })
          }
        />
        <label>Education History (comma-separated)</label>
        <input
          value={credentials.educationHistory}
          onChange={(e) =>
            setCredentials({ ...credentials, educationHistory: e.target.value })
          }
        />
        <label>CME Credits</label>
        <input
          type="number"
          value={credentials.cmeCredits}
          onChange={(e) => setCredentials({ ...credentials, cmeCredits: e.target.value })}
        />
        <label>Research Publications</label>
        <input
          type="number"
          value={credentials.researchPublications}
          onChange={(e) =>
            setCredentials({ ...credentials, researchPublications: e.target.value })
          }
        />
        <label>Test Authorization Level</label>
        <input
          value={credentials.testAuthorizationLevel}
          onChange={(e) =>
            setCredentials({ ...credentials, testAuthorizationLevel: e.target.value })
          }
        />
      </DismissibleSection>

      <DismissibleSection
        sectionKey="financialInfo"
        title="Financial Information"
        open={openSections.financialInfo}
        onClose={closeSection}
        onOpen={openSection}
      >
        <label>Bank Name</label>
        <input
          value={financial.bankName}
          onChange={(e) => setFinancial({ ...financial, bankName: e.target.value })}
        />
        <label>Bank Account Name</label>
        <input
          value={financial.bankAccountName}
          onChange={(e) =>
            setFinancial({ ...financial, bankAccountName: e.target.value })
          }
        />
        <label>Bank Account Number</label>
        <input
          value={financial.bankAccountNumber}
          onChange={(e) =>
            setFinancial({ ...financial, bankAccountNumber: e.target.value })
          }
        />
        <label>Bank Branch</label>
        <input
          value={financial.bankBranch}
          onChange={(e) => setFinancial({ ...financial, bankBranch: e.target.value })}
        />
        <label>Tax ID</label>
        <input
          value={financial.taxId}
          onChange={(e) => setFinancial({ ...financial, taxId: e.target.value })}
        />
        <label>Pension Info</label>
        <input
          value={financial.pensionInfo}
          onChange={(e) => setFinancial({ ...financial, pensionInfo: e.target.value })}
        />
        <label>Salary Structure</label>
        <input
          value={financial.salaryStructure}
          onChange={(e) =>
            setFinancial({ ...financial, salaryStructure: e.target.value })
          }
        />
        <label>Allowances</label>
        <input
          type="number"
          value={financial.allowances}
          onChange={(e) => setFinancial({ ...financial, allowances: e.target.value })}
        />
        <label>Deductions</label>
        <input
          type="number"
          value={financial.deductions}
          onChange={(e) => setFinancial({ ...financial, deductions: e.target.value })}
        />
      </DismissibleSection>

      <DismissibleSection
        sectionKey="insuranceProfile"
        title="Insurance Profile"
        open={openSections.insuranceProfile}
        onClose={closeSection}
        onOpen={openSection}
      >
        <label>Provider Code</label>
        <input
          value={insurance.providerCode}
          onChange={(e) => setInsurance({ ...insurance, providerCode: e.target.value.toUpperCase() })}
          placeholder="SHA, NHIF, PRIVATE_X"
        />
        <label>Provider Name</label>
        <input
          value={insurance.providerName}
          onChange={(e) => setInsurance({ ...insurance, providerName: e.target.value })}
        />
        <label>Member Number</label>
        <input
          value={insurance.memberNumber}
          onChange={(e) => setInsurance({ ...insurance, memberNumber: e.target.value })}
        />
        <label>Balance</label>
        <input
          type="number"
          value={insurance.balance}
          onChange={(e) => setInsurance({ ...insurance, balance: e.target.value })}
        />
        <label>Currency</label>
        <input
          value={insurance.currency}
          onChange={(e) => setInsurance({ ...insurance, currency: e.target.value.toUpperCase() })}
        />
        <label>Status</label>
        <select
          value={insurance.status}
          onChange={(e) => setInsurance({ ...insurance, status: e.target.value })}
        >
          <option value="PENDING">Pending</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </DismissibleSection>

      <DismissibleSection
        sectionKey="systemData"
        title="System Data"
        open={openSections.systemData}
        onClose={closeSection}
        onOpen={openSection}
      >
        <label>Status</label>
        <select
          value={systemProfile.status}
          onChange={(e) =>
            setSystemProfile({ ...systemProfile, status: e.target.value })
          }
        >
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="ON_LEAVE">On Leave</option>
        </select>
        <label>Access Expiration</label>
        <input
          type="date"
          value={systemProfile.accessExpiresAt}
          onChange={(e) =>
            setSystemProfile({ ...systemProfile, accessExpiresAt: e.target.value })
          }
        />
        <button type="button"
          className="primary"
          onClick={saveExtendedProfile}
          disabled={extendedSaving}
          style={{ marginTop: 8 }}
        >
          {extendedSaving ? "Saving..." : "Save Full Profile"}
        </button>
        {extendedMsg && <p style={{ marginTop: 8 }}>{extendedMsg}</p>}
      </DismissibleSection>

      <DismissibleSection
        sectionKey="roleChecklist"
        title={`Role-Specific Profile Checklist (${user?.role})`}
        open={openSections.roleChecklist}
        onClose={closeSection}
        onOpen={openSection}
      >
        <ul>
          {(roleProfileHints[user?.role] || roleProfileHints.GUEST).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </DismissibleSection>

      <DismissibleSection
        sectionKey="trainingGuide"
        title="AfyaLink Training Notes"
        open={openSections.trainingGuide}
        onClose={closeSection}
        onOpen={openSection}
      >
        <p className="muted">
          Use these notes to train this role quickly and consistently.
        </p>
        <label>Training Role</label>
        <select
          value={resolvedTrainingRole}
          onChange={(e) => setTrainingRole(e.target.value)}
          disabled={!canRoleOverride}
        >
          {viewableRoles.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        {!canRoleOverride && (
          <p className="muted" style={{ marginTop: 6 }}>
            Training notes are locked to your account role.
          </p>
        )}
        <div className="profile-row profile-actions-row" style={{ marginTop: 8 }}>
          <select value={trainingView} onChange={(e) => setTrainingView(e.target.value)}>
            <option value="FULL">Show Full Guide</option>
            <option value="WEEK">Show 7-Day Plan</option>
          </select>
          <button type="button" className="secondary" onClick={copyTrainingNotes}>
            Copy Training Notes
          </button>
          <button type="button" className="secondary" onClick={downloadTrainingNotes}>
            Download Notes
          </button>
          <button type="button" className="secondary" onClick={printTrainingNotes}>
            Print Notes
          </button>
        </div>
        <div className="profile-row profile-actions-row" style={{ marginTop: 8 }}>
          <button type="button" className="secondary" onClick={copyMasterTrainingNotes}>
            Copy Full Playbook
          </button>
          <button type="button" className="secondary" onClick={downloadMasterTrainingNotes}>
            Download Full Playbook
          </button>
          <button type="button" className="secondary" onClick={printMasterTrainingNotes}>
            Print Full Playbook
          </button>
        </div>
        {trainingMsg && <p className="muted">{trainingMsg}</p>}
        <div className="subtle-banner" style={{ marginTop: 10 }}>
          <strong>Goal:</strong> {trainingGuide.goal}
        </div>

        {trainingView === "FULL" && (
          <>
            <h4>First Hour</h4>
            <ul>
              {(trainingGuide.firstHour || []).map((item) => (
                <li key={`fh-${item}`}>{item}</li>
              ))}
            </ul>

            <h4>Daily Routine</h4>
            <ul>
              {(trainingGuide.daily || []).map((item) => (
                <li key={`dy-${item}`}>{item}</li>
              ))}
            </ul>

            <h4>Safety Rules</h4>
            <ul>
              {(trainingGuide.safety || []).map((item) => (
                <li key={`sf-${item}`}>{item}</li>
              ))}
            </ul>

            <h4>Key Metrics</h4>
            <ul>
              {(trainingGuide.kpi || []).map((item) => (
                <li key={`kp-${item}`}>{item}</li>
              ))}
            </ul>
          </>
        )}

        {trainingView === "WEEK" && (
          <>
            <h4>7-Day Onboarding Plan</h4>
            {weeklyTrainingPlan.map((w) => (
              <div key={w.day} className="card" style={{ marginTop: 8 }}>
                <strong>{w.day}: {w.title}</strong>
                <ul style={{ marginTop: 6 }}>
                  {w.focus.map((item) => (
                    <li key={`${w.day}-${item}`}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </>
        )}
      </DismissibleSection>
      </div>

      {/* ============================
         2FA SECTION
      ============================ */}
      <DismissibleSection
        sectionKey="twoFactor"
        title="Two-Factor Authentication (2FA)"
        open={openSections.twoFactor}
        onClose={closeSection}
        onOpen={openSection}
      >
        <p>
          {twoFAEnabled
            ? "2FA is enabled. You’ll be asked for a code at login."
            : "2FA is disabled. Your account uses password only."}
        </p>
        <p className="muted">Current method: {twoFAMethod}</p>
        <button type="button"
          className={twoFAEnabled ? "danger" : "success"}
          onClick={toggle2FA}
        >
          {twoFAEnabled ? "Disable 2FA" : "Enable 2FA"}
        </button>
        <div style={{ marginTop: 12 }}>
          <button type="button" className="btn-secondary" onClick={setupTotp} disabled={twoFABusy}>
            Setup Google Authenticator
          </button>
        </div>
        {totpSecret && (
          <div className="subtle-banner" style={{ marginTop: 10 }}>
            <div>
              <strong>Authenticator secret:</strong> {totpSecret}
            </div>
            {totpUrl ? (
              <div className="muted" style={{ wordBreak: "break-all" }}>
                {totpUrl}
              </div>
            ) : null}
          </div>
        )}
        {(totpSecret || twoFAMethod === "TOTP") && (
          <div style={{ marginTop: 10 }}>
            <label>Authenticator code</label>
            <input
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              placeholder="6-digit code"
            />
            <div className="actions-row mt-8">
              <button type="button" className="btn-primary" onClick={verifyTotp} disabled={twoFABusy}>
                Verify Authenticator
              </button>
              {twoFAMethod === "TOTP" && (
                <button type="button" className="btn-secondary" onClick={disableTotp} disabled={twoFABusy}>
                  Disable Authenticator
                </button>
              )}
            </div>
          </div>
        )}
        {recoveryCodes.length > 0 && (
          <div className="subtle-banner" style={{ marginTop: 10 }}>
            <strong>Recovery codes (store securely):</strong>
            <div style={{ marginTop: 6 }}>
              {recoveryCodes.join(" • ")}
            </div>
          </div>
        )}
        {twoFAMsg ? <p className="muted" style={{ marginTop: 8 }}>{twoFAMsg}</p> : null}
      </DismissibleSection>

      {/* ============================
         CHANGE PASSWORD SECTION
      ============================ */}
      <DismissibleSection
        sectionKey="password"
        title="Change Password"
        open={openSections.password}
        onClose={closeSection}
        onOpen={openSection}
      >

        {pwError && <div className="auth-error">{pwError}</div>}
        {pwMessage && <div className="auth-success">{pwMessage}</div>}

        <form className="form" onSubmit={handlePasswordChange}>
          <label>Current password</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />

          <label>New password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />

          <label>Confirm new password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          <button className="btn-primary" type="submit" disabled={pwLoading} style={{ marginTop: 8 }}>
            {pwLoading ? "Updating..." : "Change password"}
          </button>
        </form>
      </DismissibleSection>

      {error && <p style={{ color: "red", marginTop: 16 }}>{error}</p>}
    </div>
  );
}
