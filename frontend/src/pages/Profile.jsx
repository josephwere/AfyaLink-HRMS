// frontend/src/pages/Profile.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../utils/auth";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { redirectByRole } from "../utils/redirectByRole";
import CountryPhoneInput, { toE164 } from "../components/CountryPhoneInput";
import { useGoogleAuth } from "../auth/useGoogleAuth.jsx";
import PasswordInput from "../components/PasswordInput";
import DownloadMenu from "../components/DownloadMenu";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { getCountryOptions, splitDialAndLocal } from "../utils/countryDialCodes";
import { exportRichTextDocument } from "../utils/fileExport";
import { ROLE_VIEW_OPTIONS } from "../utils/roleViewOptions";
import { useAppLanguage } from "../utils/appLanguage.jsx";
import { normalizeRole } from "../utils/normalizeRole";
import {
  applyAccessibilityPrefs,
  getDefaultAccessibilityPrefs,
  loadAccessibilityPrefs,
  saveAccessibilityPrefs,
} from "../utils/accessibilityPrefs";
import { useUiPreferences } from "../utils/uiPreferences";
import { showActionSuccessGuide } from "../components/ActionSuccessGuide";
import EditableSection from "../components/EditableSection";
import { useProfile } from "../hooks/useProfile";

const COOLDOWN_KEY = "verifyCooldownUntil";
const PROFILE_CACHE_VERSION = 1;
const PROFILE_SECTION_LABELS = {
  nationalId: "National ID",
  professionalLicense: "Professional license",
  basicInfo: "Personal information",
  employmentInfo: "Employment information",
  credentialsInfo: "Credentials",
  financialInfo: "Financial information",
  insuranceProfile: "Insurance profile",
  systemData: "System data",
};

const DEPARTMENT_OPTIONS = [
  "Cardiology",
  "Dermatology",
  "Emergency",
  "General Practice",
  "ICU",
  "Laboratory",
  "Oncology",
  "Orthopedics",
  "Pediatrics",
  "Pharmacy",
  "Radiology",
  "Surgery",
  "Administration",
  "HR",
  "Finance",
  "Security",
  "IT",
  "Operations",
  "Other",
];

function profileCacheKey(user) {
  const id = user?._id || user?.id || user?.email || user?.phone || "anonymous";
  return `afyalink_profile_cache_v${PROFILE_CACHE_VERSION}:${String(id)}`;
}

function readCachedProfile(user) {
  if (typeof window === "undefined" || !user) return null;
  try {
    const raw = localStorage.getItem(profileCacheKey(user));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== PROFILE_CACHE_VERSION || !parsed.profile) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedProfile(user, profile) {
  if (typeof window === "undefined" || !user || !profile) return;
  try {
    localStorage.setItem(
      profileCacheKey(user),
      JSON.stringify({
        v: PROFILE_CACHE_VERSION,
        storedAt: new Date().toISOString(),
        profile,
      })
    );
  } catch {
    // Ignore storage quota failures for profile snapshot caching.
  }
}

function toCachedProfilePayload(me) {
  if (!me || typeof me !== "object") return null;
  return {
    userId: me?.userId || "",
    twoFactorEnabled: Boolean(me?.twoFactorEnabled),
    twoFactorMethod: me?.twoFactorMethod || "OTP",
    emailVerified: Boolean(me?.emailVerified),
    phoneVerified: Boolean(me?.phoneVerified),
    authProvider: me?.authProvider || "local",
    authMethods: Array.isArray(me?.authMethods) ? me.authMethods : [me?.authProvider || "local"],
    hasPassword: Boolean(me?.hasPassword),
    phone: me?.phone || "",
    nationalIdNumber: me?.nationalIdNumber || "",
    nationalIdCountry: me?.nationalIdCountry || "",
    licenseNumber: me?.licenseNumber || "",
    licenseExpiry: me?.licenseExpiry || "",
    verificationWarning: me?.verificationWarning || null,
    gender: me?.gender || "",
    dateOfBirth: me?.dateOfBirth || "",
    nationality: me?.nationality || "",
    address: me?.address || "",
    emergencyContact: me?.emergencyContact || {},
    employment: me?.employment || {},
    credentials: me?.credentials || {},
    financial: me?.financial || {},
    systemProfile: me?.systemProfile || {},
    insuranceProfile: me?.insuranceProfile || {},
    familyMonitoring: me?.familyMonitoring || {},
    uiPreferences: me?.uiPreferences || {},
  };
}

function hasAnyProfileValue(value) {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.values(value).some(hasAnyProfileValue);
  return String(value).trim() !== "";
}

function inferSavedProfileSections(me = {}) {
  return {
    nationalId: hasAnyProfileValue({
      nationalIdNumber: me?.nationalIdNumber,
      nationalIdCountry: me?.nationalIdCountry,
    }),
    professionalLicense: hasAnyProfileValue({
      licenseNumber: me?.licenseNumber,
      licenseExpiry: me?.licenseExpiry,
    }),
    basicInfo: hasAnyProfileValue({
      gender: me?.gender,
      dateOfBirth: me?.dateOfBirth,
      nationality: me?.nationality,
      address: me?.address,
      emergencyContact: me?.emergencyContact,
    }),
    employmentInfo: hasAnyProfileValue(me?.employment),
    credentialsInfo: hasAnyProfileValue(me?.credentials),
    financialInfo: hasAnyProfileValue(me?.financial),
    insuranceProfile: hasAnyProfileValue(me?.insuranceProfile),
    systemData: hasAnyProfileValue(me?.systemProfile),
  };
}

function DismissibleSection({ title, children, className = "", eyebrow = "", aside = null }) {
  return (
    <div className={`card profile-card dismissible-section ${className}`.trim()}>
      <div className="dismissible-head">
        <div>
          {eyebrow ? <div className="profile-panel-eyebrow">{eyebrow}</div> : null}
          <h3>{title}</h3>
        </div>
        {aside}
      </div>
      {children}
    </div>
  );
}

export default function Profile() {
  const {
    user,
    logout,
    canRoleOverride,
    roleOverride,
    strictImpersonation,
    setRoleOverride,
    setStrictImpersonation,
  } = useAuth();
  const { language, options: languageOptions } = useAppLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { setUiPreferences, flushUiPreferences } = useUiPreferences();
  const {
    loadProfileWorkspace: loadProfileWorkspaceFromHook,
    updateProfileSection: updateProfileSectionFromHook,
    saveFamilyPreferences: saveFamilyPreferencesFromHook,
    getFamilyMonitoring: getFamilyMonitoringFromHook,
    searchFamilyProfiles: searchFamilyProfilesFromHook,
    linkFamilyMinor: linkFamilyMinorFromHook,
    unlinkFamilyMinor: unlinkFamilyMinorFromHook,
    toggleTwoFactor: toggleTwoFactorFromHook,
    setupTotp: setupTotpFromHook,
    verifyTotp: verifyTotpFromHook,
    disableTotp: disableTotpFromHook,
    resendVerificationEmail: resendVerificationEmailFromHook,
    updateProfileField: updateProfileFieldFromHook,
    requestPhoneOtp: requestPhoneOtpFromHook,
    verifyPhoneOtp: verifyPhoneOtpFromHook,
    changePassword: changePasswordFromHook,
    exportAccountData: exportAccountDataFromHook,
    deleteAccount: deleteAccountFromHook,
  } = useProfile();
  const [viewRole, setViewRole] = useState("");
  const selectedLanguageLabel =
    languageOptions.find((item) => item.code === language)?.label || String(language || "en").toUpperCase();

  const viewableRoles = ROLE_VIEW_OPTIONS;
  const actualRole = user?.actualRole || user?.role;
  const canManageGovPrefs = [
    "SUPER_ADMIN",
    "SYSTEM_ADMIN",
    "DEVELOPER",
    "GOVERNMENT_ADMIN",
    "GOVERNMENT_REGULATOR",
    "GOVERNMENT_AUDITOR",
    "GOVERNMENT_INSPECTOR",
    "GOVERNMENT_ANALYST",
  ].includes(actualRole);
  const isPatientProfile = ["PATIENT", "GUEST"].includes(actualRole);
  const isStaffProfile = !["PATIENT", "GUEST"].includes(actualRole);
  const isAdminProfile = [
    "SUPER_ADMIN",
    "SYSTEM_ADMIN",
    "HOSPITAL_ADMIN",
    "DEVELOPER",
    "GOVERNMENT_ADMIN",
    "GOVERNMENT_REGULATOR",
    "GOVERNMENT_AUDITOR",
    "GOVERNMENT_INSPECTOR",
    "GOVERNMENT_ANALYST",
    "HR_MANAGER",
    "PAYROLL_OFFICER",
    "SECURITY_ADMIN",
  ].includes(actualRole);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [profileUserId, setProfileUserId] = useState(user?.userId || "");
  const [copyIdMsg, setCopyIdMsg] = useState("");
  const loadRetryRef = useRef(null);
  const [syncing, setSyncing] = useState(false);
  const [authMethods, setAuthMethods] = useState(["local"]);
  const [hasPassword, setHasPassword] = useState(true);
  const [googleLinkMessage, setGoogleLinkMessage] = useState("");
  const [googleLinkError, setGoogleLinkError] = useState("");

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
  const [sectionSaving, setSectionSaving] = useState({});
  const [sectionMsg, setSectionMsg] = useState({});
  const [sectionSaved, setSectionSaved] = useState({});
  const [sectionEditing, setSectionEditing] = useState({});

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
  const [familyPrefs, setFamilyPrefs] = useState({
    receiveMinorAlerts: true,
    showDailyMinorSummary: true,
  });
  const [linkedMinors, setLinkedMinors] = useState([]);
  const [linkedMinorCount, setLinkedMinorCount] = useState(0);
  const [familyLoaded, setFamilyLoaded] = useState(false);
  const [familySearch, setFamilySearch] = useState({
    q: "",
    dob: "",
    relationship: "PARENT",
    notes: "",
  });
  const [familyResults, setFamilyResults] = useState([]);
  const [familyBusy, setFamilyBusy] = useState(false);
  const [familyMsg, setFamilyMsg] = useState("");

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMessage, setPwMessage] = useState("");
  const [pwError, setPwError] = useState("");
  const [a11yPrefs, setA11yPrefs] = useState(getDefaultAccessibilityPrefs());
  const [showSecretsOnHover, setShowSecretsOnHover] = useState(false);
  const [uiPrefSaving, setUiPrefSaving] = useState(false);
  const [uiPrefMsg, setUiPrefMsg] = useState("");
  const [activeSection, setActiveSection] = useState("verificationStatus");
  const [trainingRole, setTrainingRole] = useState("");
  const [trainingMsg, setTrainingMsg] = useState("");
  const [trainingView, setTrainingView] = useState("FULL");
  const [privacyMsg, setPrivacyMsg] = useState("");
  const [privacyError, setPrivacyError] = useState("");
  const [exportBusy, setExportBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletePassword, setDeletePassword] = useState("");

  useEffect(() => {
    restoreCooldown();
  }, []);

  useEffect(() => {
    if (!user) return undefined;

    const cached = readCachedProfile(user);
    if (cached?.profile) {
      applyProfilePayload(cached.profile);
      setProfileLoaded(true);
      setLoading(false);
      setError("");
    }

    loadStatus(1, { showSpinner: !cached?.profile });

    return () => {
      if (loadRetryRef.current) {
        clearTimeout(loadRetryRef.current);
        loadRetryRef.current = null;
      }
    };
  }, [user?._id, user?.id, user?.email]);

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

  const handleLinkedGoogleSuccess = (data) => {
    setGoogleLinkError("");
    setGoogleLinkMessage("Google sign-in linked to your account.");
    const methods = Array.isArray(data?.user?.authMethods)
      ? data.user.authMethods
      : [data?.user?.authProvider || "local"];
    setAuthMethods(methods);
  };

  const { GoogleButton, error: googleButtonError, clearError: clearGoogleButtonError } = useGoogleAuth({
    onSuccess: handleLinkedGoogleSuccess,
    redirectOnSuccess: false,
  });

  useEffect(() => {
    if (googleButtonError) {
      setGoogleLinkError(googleButtonError);
    }
  }, [googleButtonError]);

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

  const copyAccountId = async () => {
    const value = profileUserId || user?.userId || "";
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopyIdMsg("Copied");
      window.setTimeout(() => setCopyIdMsg(""), 1600);
    } catch {
      setCopyIdMsg("Copy unavailable");
      window.setTimeout(() => setCopyIdMsg(""), 1600);
    }
  };

  const applyProfilePayload = (me) => {
    setTwoFAEnabled(Boolean(me?.twoFactorEnabled));
    setTwoFAMethod(me?.twoFactorMethod || "OTP");
    setEmailVerified(Boolean(me?.emailVerified));
    setPhoneVerified(Boolean(me?.phoneVerified));
    const methods = Array.isArray(me?.authMethods)
      ? me.authMethods
      : [me?.authProvider || "local"];
    setAuthMethods(methods);
    setHasPassword(Boolean(me?.hasPassword));

    const parsedPhone = splitDialAndLocal(me?.phone || "");
    setPhoneCountry(parsedPhone.countryCode || "");
    setPhoneLocal(parsedPhone.local || "");
    setProfileUserId(me?.userId || user?.userId || "");
    setIdNumber(me?.nationalIdNumber || "");
    setIdCountry(me?.nationalIdCountry || "");
    setLicenseNumber(me?.licenseNumber || "");
    setLicenseExpiry(me?.licenseExpiry ? String(me.licenseExpiry).slice(0, 10) : "");
    setVerificationWarning(me?.verificationWarning || null);

    setBasic({
      gender: me?.gender || "",
      dateOfBirth: me?.dateOfBirth ? String(me.dateOfBirth).slice(0, 10) : "",
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
      hireDate: me?.employment?.hireDate ? String(me.employment.hireDate).slice(0, 10) : "",
      contractStart: me?.employment?.contractStart ? String(me.employment.contractStart).slice(0, 10) : "",
      contractEnd: me?.employment?.contractEnd ? String(me.employment.contractEnd).slice(0, 10) : "",
      workLocation: me?.employment?.workLocation || "",
      branch: me?.employment?.branch || "",
    });

    const certifications = Array.isArray(me?.credentials?.certifications)
      ? me.credentials.certifications
      : typeof me?.credentials?.certifications === "string"
        ? me.credentials.certifications.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
    const educationHistory = Array.isArray(me?.credentials?.educationHistory)
      ? me.credentials.educationHistory
      : typeof me?.credentials?.educationHistory === "string"
        ? me.credentials.educationHistory.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

    setCredentials({
      specialization: me?.credentials?.specialization || "",
      subSpecialization: me?.credentials?.subSpecialization || "",
      cmeCredits: me?.credentials?.cmeCredits ?? "",
      researchPublications: me?.credentials?.researchPublications ?? "",
      testAuthorizationLevel: me?.credentials?.testAuthorizationLevel || "",
      certifications: certifications.join(", "),
      educationHistory: educationHistory.join(", "),
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
        ? String(me.systemProfile.accessExpiresAt).slice(0, 10)
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

    setFamilyPrefs({
      receiveMinorAlerts: me?.familyMonitoring?.preferences?.receiveMinorAlerts !== false,
      showDailyMinorSummary: me?.familyMonitoring?.preferences?.showDailyMinorSummary !== false,
    });
    setLinkedMinorCount(Number(me?.familyMonitoring?.linkedMinorCount || 0));
    setLinkedMinors([]);
    setFamilyLoaded(false);
    setShowSecretsOnHover(Boolean(me?.uiPreferences?.showSecretsOnHover));
    setSectionSaved(inferSavedProfileSections(me));
    setSectionEditing({});
  };

  /* -------------------------
     Load Profile Workspace (guarded)
     Avoid showing a generic "security settings" error for transient cold starts.
  -------------------------- */
  const loadStatus = async (attempt = 1, { showSpinner = true } = {}) => {
    if (loadRetryRef.current) {
      clearTimeout(loadRetryRef.current);
      loadRetryRef.current = null;
    }

    if (attempt === 1) {
      setSyncing(true);
      setLoading(Boolean(showSpinner));
      setError("");
      if (showSpinner) setProfileLoaded(false);
    }

    try {
      const res = await loadProfileWorkspaceFromHook({
        warmupPath: "/readyz",
        timeoutSequence: [20000, 30000, 45000],
      });
      const me = res?.payload || res;

      applyProfilePayload(me);
      const cachePayload = toCachedProfilePayload(me);
      if (cachePayload) writeCachedProfile(user, cachePayload);

      setProfileLoaded(true);
      setError("");
      setLoading(false);
      setSyncing(false);
    } catch (err) {
      const maxAttempts = 2;
      if (attempt < maxAttempts) {
        loadRetryRef.current = setTimeout(
          () => loadStatus(attempt + 1, { showSpinner }),
          900 * attempt
        );
        return;
      }
      if (showSpinner) setProfileLoaded(false);
      setError(
        err?.message ||
          "Profile workspace is taking longer than usual. Please try again."
      );
      setLoading(false);
      setSyncing(false);
    }
  };

  const buildExtendedPayload = () => ({
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
  });

  const sectionPayloadMap = (allPayload) => ({
    basicInfo: {
      gender: allPayload.gender,
      dateOfBirth: allPayload.dateOfBirth,
      nationality: allPayload.nationality,
      address: allPayload.address,
      emergencyContact: allPayload.emergencyContact,
    },
    employmentInfo: { employment: allPayload.employment },
    credentialsInfo: { credentials: allPayload.credentials },
    financialInfo: { financial: allPayload.financial },
    insuranceProfile: { insuranceProfile: allPayload.insuranceProfile },
    systemData: { systemProfile: allPayload.systemProfile },
  });

  const isSectionLocked = (sectionKey) => Boolean(sectionSaved[sectionKey] && !sectionEditing[sectionKey]);

  const beginSectionEdit = (sectionKey) => {
    setSectionEditing((prev) => ({ ...prev, [sectionKey]: true }));
    setSectionMsg((prev) => ({ ...prev, [sectionKey]: "" }));
  };

  const saveExtendedProfile = async (sectionKey = "") => {
    setExtendedSaving(true);
    setExtendedMsg("");
    if (sectionKey) {
      setSectionSaving((prev) => ({ ...prev, [sectionKey]: true }));
      setSectionMsg((prev) => ({ ...prev, [sectionKey]: "" }));
    }
    try {
      const allPayload = buildExtendedPayload();
      const payload = sectionKey ? sectionPayloadMap(allPayload)[sectionKey] || {} : allPayload;
      await updateProfileSectionFromHook(payload);
      const okMsg = sectionKey ? "Section saved." : "Profile details updated.";
      setExtendedMsg(okMsg);
      if (sectionKey) {
        setSectionSaved((prev) => ({ ...prev, [sectionKey]: true }));
        setSectionEditing((prev) => ({ ...prev, [sectionKey]: false }));
        setSectionMsg((prev) => ({ ...prev, [sectionKey]: okMsg }));
      }
      showActionSuccessGuide({
        title: sectionKey
          ? `${PROFILE_SECTION_LABELS[sectionKey] || "Profile section"} saved`
          : "Profile Updated Successfully",
        message: "Your information has been securely saved and is ready for your care team where applicable.",
        tips: [
          "Book appointments",
          "Consult doctors online",
          "Use the AI health assistant",
          "View prescriptions and records",
        ],
        actions: isPatientProfile
          ? [
              { label: "Book Appointment", path: "/app/portal/appointments/index" },
              {
                label: "Ask AI",
                action: "ai",
                aiPrompt: "Review my health profile and suggest what I should prepare before my next healthcare visit.",
                variant: "secondary",
              },
              { label: "Health Records", path: "/app/portal/records/index", variant: "secondary" },
            ]
          : [
              { label: "Return Dashboard", path: redirectByRole(user) },
              {
                label: "Ask AI",
                action: "ai",
                aiPrompt: "Help me understand the next best action after updating this AfyaLink profile.",
                variant: "secondary",
              },
              { label: "Notifications", path: "/app/platform/inbox/notifications", variant: "secondary" },
            ],
        aiPrompt: "Review my saved AfyaLink profile and suggest what I should do next.",
        notificationCategory: "ACCOUNT",
      });
    } catch (err) {
      const failMsg = err.message || "Failed to update profile details";
      setExtendedMsg(failMsg);
      if (sectionKey) {
        setSectionMsg((prev) => ({ ...prev, [sectionKey]: failMsg }));
      }
    } finally {
      setExtendedSaving(false);
      if (sectionKey) {
        setSectionSaving((prev) => ({ ...prev, [sectionKey]: false }));
      }
    }
  };

  const updateA11yPref = (field, value) => {
    const next = { ...a11yPrefs, [field]: value };
    setA11yPrefs(next);
    saveAccessibilityPrefs(user, next);
    applyAccessibilityPrefs(next);
    setUiPrefSaving(true);
    setUiPrefMsg("");
    const queued = setUiPreferences(
      {
        accessibility: next,
      },
      { persist: false }
    );
    Promise.resolve(flushUiPreferences(queued))
      .then((ok) => {
        if (!ok) {
          throw new Error("Failed to save display preferences.");
        }
        setUiPrefMsg("Display preferences saved.");
      })
      .catch((err) => {
        setUiPrefMsg(err?.message || "Failed to save display preferences.");
      })
      .finally(() => {
        setUiPrefSaving(false);
      });
  };

  const updateShowSecretsPref = async (nextValue) => {
    const prev = showSecretsOnHover;
    setShowSecretsOnHover(nextValue);
    setUiPrefSaving(true);
    setUiPrefMsg("");
    try {
      const queued = setUiPreferences(
        {
          showSecretsOnHover: nextValue,
        },
        { persist: false }
      );
      const ok = await flushUiPreferences(queued);
      if (!ok) {
        throw new Error("Failed to save preference.");
      }
      setUiPrefMsg("Preference saved.");
    } catch (err) {
      setShowSecretsOnHover(prev);
      setUiPrefMsg(err?.message || "Failed to save preference.");
    } finally {
      setUiPrefSaving(false);
    }
  };

  const resetA11yPrefs = () => {
    const defaults = getDefaultAccessibilityPrefs();
    setA11yPrefs(defaults);
    saveAccessibilityPrefs(user, defaults);
    applyAccessibilityPrefs(defaults);
    setUiPrefSaving(true);
    setUiPrefMsg("");
    const queued = setUiPreferences(
      {
        accessibility: defaults,
      },
      { persist: false }
    );
    Promise.resolve(flushUiPreferences(queued))
      .then((ok) => {
        if (!ok) {
          throw new Error("Failed to reset display preferences.");
        }
        setUiPrefMsg("Display preferences reset.");
      })
      .catch((err) => {
        setUiPrefMsg(err?.message || "Failed to reset display preferences.");
      })
      .finally(() => {
        setUiPrefSaving(false);
      });
  };

  const saveFamilyPreferences = async () => {
    setFamilyBusy(true);
    setFamilyMsg("");
    try {
      await saveFamilyPreferencesFromHook({ familyMonitoringPreferences: familyPrefs });
      setFamilyMsg("Family monitoring preferences saved.");
    } catch (err) {
      setFamilyMsg(err?.message || "Failed to save family monitoring preferences.");
    } finally {
      setFamilyBusy(false);
    }
  };

  const refreshFamilyMonitoring = async ({ silent = false } = {}) => {
    if (!silent) {
      setFamilyBusy(true);
      setFamilyMsg("");
    }
    try {
      const data = await getFamilyMonitoringFromHook();
      const items = Array.isArray(data?.items) ? data.items : [];
      setLinkedMinors(items);
      setLinkedMinorCount(items.length);
      setFamilyPrefs({
        receiveMinorAlerts: data?.preferences?.receiveMinorAlerts !== false,
        showDailyMinorSummary: data?.preferences?.showDailyMinorSummary !== false,
      });
      setFamilyLoaded(true);
    } catch (err) {
      setFamilyMsg(err?.message || "Failed to load family monitoring.");
    } finally {
      if (!silent) {
        setFamilyBusy(false);
      }
    }
  };

  useEffect(() => {
    const isFamilySection =
      activeSection === "familyPreferences" ||
      activeSection === "familyLinkChild" ||
      activeSection === "familyLinkedChildren";
    if (!isFamilySection || familyLoaded) return;
    refreshFamilyMonitoring({ silent: false });
  }, [activeSection, familyLoaded]);

  const searchMinorProfiles = async () => {
    if (!familySearch.q.trim() || !familySearch.dob) {
      setFamilyMsg("Enter the child's name and date of birth before searching.");
      return;
    }
    setFamilyBusy(true);
    setFamilyMsg("");
    try {
      const data = await searchFamilyProfilesFromHook({
        q: familySearch.q.trim(),
        dob: familySearch.dob,
      });
      setFamilyResults(Array.isArray(data?.items) ? data.items : []);
      if (!(data?.items || []).length) {
        setFamilyMsg("No matching minor profile was found in your hospital scope.");
      }
    } catch (err) {
      setFamilyResults([]);
      setFamilyMsg(err?.message || "Failed to search minor profiles.");
    } finally {
      setFamilyBusy(false);
    }
  };

  const linkMinorProfile = async (patientId) => {
    setFamilyBusy(true);
    setFamilyMsg("");
    try {
      const data = await linkFamilyMinorFromHook({
        patientId,
        relationship: familySearch.relationship,
        notes: familySearch.notes,
      });
      const items = Array.isArray(data?.items) ? data.items : [];
      setLinkedMinors(items);
      setLinkedMinorCount(items.length);
      setFamilyLoaded(true);
      setFamilyResults((prev) =>
        prev.map((item) =>
          item.patientId === patientId ? { ...item, alreadyLinked: true } : item
        )
      );
      setFamilyMsg(data?.message || "Child linked successfully.");
    } catch (err) {
      setFamilyMsg(err?.message || "Failed to link child profile.");
    } finally {
      setFamilyBusy(false);
    }
  };

  const unlinkMinorProfile = async (patientId) => {
    setFamilyBusy(true);
    setFamilyMsg("");
    try {
      const data = await unlinkFamilyMinorFromHook(patientId);
      const items = Array.isArray(data?.items) ? data.items : [];
      setLinkedMinors(items);
      setLinkedMinorCount(items.length);
      setFamilyLoaded(true);
      setFamilyResults((prev) =>
        prev.map((item) =>
          item.patientId === patientId ? { ...item, alreadyLinked: false } : item
        )
      );
      setFamilyMsg(data?.message || "Child removed from monitoring.");
    } catch (err) {
      setFamilyMsg(err?.message || "Failed to remove child profile.");
    } finally {
      setFamilyBusy(false);
    }
  };

  /* -------------------------
     Toggle 2FA
  -------------------------- */
  const toggle2FA = async () => {
    try {
      const next = !twoFAEnabled;
      await toggleTwoFactorFromHook({ enabled: next });
      setTwoFAEnabled(next);
      setTwoFAMethod(next ? "OTP" : "OTP");
      setTwoFAMsg(next ? "OTP 2FA enabled." : "2FA disabled.");
    } catch {
      setTwoFAMsg("Failed to update 2FA setting. Please try again.");
    }
  };

  const setupTotp = async () => {
    setTwoFABusy(true);
    setTwoFAMsg("");
    try {
      const data = await setupTotpFromHook();
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
      const data = await verifyTotpFromHook({ code: totpCode.trim() });
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
      await disableTotpFromHook({ code: totpCode.trim() });
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
      const data = await resendVerificationEmailFromHook({ email: user?.email });
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
      await updateProfileFieldFromHook({
        nationalIdNumber: idNumber || undefined,
        nationalIdCountry: idCountry || undefined,
      });
      setIdMsg("National ID updated");
      setSectionSaved((prev) => ({ ...prev, nationalId: true }));
      setSectionEditing((prev) => ({ ...prev, nationalId: false }));
      showActionSuccessGuide({
        title: "National ID Saved",
        message: "Your identity details have been securely saved.",
        icon: "ID",
        nextActions: [
          { label: "Edit Profile", path: "/app/platform/account/profile", variant: "secondary" },
          {
            label: "Ask AI",
            action: "ai",
            aiPrompt: "Explain what profile details I should keep current before healthcare visits.",
            variant: "secondary",
          },
        ],
        notificationCategory: "ACCOUNT",
      });
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
      await updateProfileFieldFromHook({
        licenseNumber: licenseNumber || undefined,
        licenseExpiry: licenseExpiry || undefined,
      });
      setLicenseMsg("License updated");
      setSectionSaved((prev) => ({ ...prev, professionalLicense: true }));
      setSectionEditing((prev) => ({ ...prev, professionalLicense: false }));
      showActionSuccessGuide({
        title: "Professional License Saved",
        message: "Your clinical credential details have been updated.",
        icon: "ID",
        nextActions: [
          { label: "Return Dashboard", path: redirectByRole(user), variant: "secondary" },
          {
            label: "Ask AI",
            action: "ai",
            aiPrompt: "Help me review which professional profile details should stay current in a hospital system.",
            variant: "secondary",
          },
        ],
        notificationCategory: "ACCOUNT",
      });
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
      await requestPhoneOtpFromHook({ phone: formattedPhone || undefined });
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
      await verifyPhoneOtpFromHook({ otp: phoneOtp.trim() });
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
    const needsCurrentPassword = !(
      authMethods.includes("google") &&
      !authMethods.includes("local") &&
      !hasPassword
    );

    try {
      const data = await changePasswordFromHook(
        needsCurrentPassword ? { currentPassword, newPassword } : { newPassword }
      );

      setPwMessage("Password changed successfully");
      setHasPassword(true);
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
        "Review connector delivery failures and mapping issues.",
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
        "Open the developer workspace to review recent delivery issues and system incidents.",
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

  const exportTrainingNotes = (format) => {
    try {
      const plainText = buildTrainingLines().join("\n");
      exportRichTextDocument({
        filenameBase: `afyalink-training-${String(resolvedTrainingRole || "role").toLowerCase()}`,
        format,
        plainText,
        markdownText: plainText,
        htmlBody: `<pre>${plainText}</pre>`,
        title: `AfyaLink Training - ${resolvedTrainingRole}`,
      });
      setTrainingMsg(format === "pdf" ? "PDF export opened." : `Training notes downloaded as .${format}.`);
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

  const exportMasterTrainingNotes = (format) => {
    try {
      const plainText = buildMasterTrainingLines().join("\n");
      exportRichTextDocument({
        filenameBase: "afyalink-role-training-playbook",
        format,
        plainText,
        markdownText: plainText,
        htmlBody: `<pre>${plainText}</pre>`,
        title: "AfyaLink Role Training Playbook",
      });
      setTrainingMsg(format === "pdf" ? "PDF export opened." : `Full role playbook downloaded as .${format}.`);
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

  const downloadAccountExport = async () => {
    setPrivacyMsg("");
    setPrivacyError("");
    setExportBusy(true);
    try {
      const data = await exportAccountDataFromHook();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `afyalink-account-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setPrivacyMsg("Account export downloaded.");
    } catch (err) {
      setPrivacyError(err?.message || "We could not export your account data right now.");
    } finally {
      setExportBusy(false);
    }
  };

  const deleteAccount = async () => {
    setPrivacyMsg("");
    setPrivacyError("");
    setDeleteBusy(true);
    try {
      const data = await deleteAccountFromHook({
        confirmText: deleteConfirmText,
        currentPassword: deletePassword,
      });
      setPrivacyMsg(data?.message || "Account deleted. Signing out.");
      await logout();
    } catch (err) {
      setPrivacyError(err?.message || "We could not delete this account right now.");
    } finally {
      setDeleteBusy(false);
    }
  };

  const profileSections = useMemo(() => {
    const sections = [
      canRoleOverride
        ? {
            key: "roleSwitcher",
            group: "Administration",
            title: "Workspace role view",
            description: "Preview any role experience from one account without leaving your profile.",
            badge: strictImpersonation ? "Strict mode" : "Founder view",
          }
        : null,
      {
        key: "verificationStatus",
        group: "Account",
        title: "Verification Status",
        description: "Check the trust state of your email and phone before you change anything else.",
        badge: emailVerified && phoneVerified ? "Ready" : "Attention",
      },
      {
        key: "phoneVerification",
        group: "Account",
        title: "Phone Verification",
        description: "Verify your phone number for OTP, security, and recovery workflows.",
        badge: phoneVerified ? "Verified" : "OTP needed",
      },
      {
        key: "nationalId",
        group: "Account",
        title: "National ID",
        description: "Store your national ID for compliance, family linking, and claims.",
        badge: idNumber ? "On file" : "Missing",
      },
      {
        key: "professionalLicense",
        group: "Account",
        title: "Professional License",
        description: "Keep your license number and expiry up to date for clinical roles.",
        badge: licenseNumber ? "On file" : "Optional",
      },
      {
        key: "basicInfo",
        group: "Account",
        title: "Personal Information",
        description: "Manage your demographic profile and emergency contact details.",
        badge: basic.dateOfBirth || basic.nationality ? "Configured" : "Incomplete",
      },
      {
        key: "twoFactor",
        group: "Access & Security",
        title: "Two-Factor Authentication",
        description: "Control OTP and authenticator protection for sign-in.",
        badge: twoFAEnabled ? twoFAMethod : "Disabled",
      },
      {
        key: "password",
        group: "Access & Security",
        title: "Password & Login",
        description: "Update your password or create a backup password for direct sign-in.",
        badge: hasPassword ? "Password ready" : "Set password",
      },
      {
        key: "privacyData",
        group: "Privacy & Legal",
        title: "Privacy & Data",
        description: "Export your account data, review legal terms, or permanently delete this account.",
        badge: "Controls",
      },
      {
        key: "accessibility",
        group: "Preferences",
        title: "Display & Accessibility",
        description: "Choose your app language and tune text, spacing, and input density.",
        badge: selectedLanguageLabel,
      },
      canManageGovPrefs
        ? {
            key: "adminPreferences",
            group: "Administration",
            title: "Admin Preferences",
            description: "Control privileged interface behavior such as secret visibility.",
            badge: showSecretsOnHover ? "Hover reveal on" : "Standard",
          }
        : null,
      {
        key: "insuranceProfile",
        group: "Care & Coverage",
        title: "Insurance Profile",
        description: "Maintain your active insurer, member number, and benefit status.",
        badge: insurance.status || "Pending",
      },
      isPatientProfile || linkedMinorCount
        ? {
            key: "familyPreferences",
            group: "Care & Coverage",
            title: "Family Preferences",
            description: "Control alerts and dashboard summaries for linked children.",
            badge: linkedMinorCount ? `${linkedMinorCount} linked` : "No links",
          }
        : null,
      isPatientProfile || linkedMinorCount
        ? {
            key: "familyLinkChild",
            group: "Care & Coverage",
            title: "Link a Child",
            description: "Find a minor profile and link it to your account as a parent or guardian.",
            badge: "Search",
          }
        : null,
      isPatientProfile || linkedMinorCount
        ? {
            key: "familyLinkedChildren",
            group: "Care & Coverage",
            title: "Linked Children",
            description: "Review linked minors and remove access if needed.",
            badge: linkedMinorCount ? `${linkedMinorCount} linked` : "None",
          }
        : null,
      isStaffProfile
        ? {
            key: "employmentInfo",
            group: "Professional",
            title: "Employment Information",
            description: "Update employment type, reporting line, location, and contract dates.",
            badge: employment.department || "Pending",
          }
        : null,
      isStaffProfile
        ? {
            key: "credentialsInfo",
            group: "Professional",
            title: "Credentials & Professional Data",
            description: "Keep licenses, specialization, CME credits, and certifications up to date.",
            badge: credentials.specialization || "Incomplete",
          }
        : null,
      isStaffProfile
        ? {
            key: "financialInfo",
            group: "Professional",
            title: "Financial Information",
            description: "Maintain payroll-linked banking, tax, pension, and salary details.",
            badge: financial.bankName || "Pending",
          }
        : null,
      isStaffProfile || isAdminProfile
        ? {
            key: "systemData",
            group: "Administration",
            title: "System Data",
            description: "Review access lifecycle, internal status, and account availability settings.",
            badge: systemProfile.status || "Active",
          }
        : null,
      isStaffProfile
        ? {
            key: "roleChecklist",
            group: "Professional",
            title: "Role Checklist",
            description: "Use a role-specific readiness checklist to keep profile completeness on track.",
            badge: actualRole,
          }
        : null,
      isStaffProfile || canRoleOverride
        ? {
            key: "trainingGuide",
            group: "Professional",
            title: "Training Notes",
            description: "Open the role playbook, export training notes, and print onboarding guides.",
            badge: resolvedTrainingRole,
          }
        : null,
    ].filter(Boolean);

    return sections;
	  }, [
	    actualRole,
	    basic.dateOfBirth,
	    basic.nationality,
	    canManageGovPrefs,
	    canRoleOverride,
	    credentials.specialization,
	    emailVerified,
	    employment.department,
	    financial.bankName,
	    hasPassword,
	    idNumber,
	    insurance.status,
	    isAdminProfile,
	    isPatientProfile,
	    isStaffProfile,
	    licenseNumber,
	    linkedMinorCount,
	    phoneVerified,
	    resolvedTrainingRole,
	    selectedLanguageLabel,
	    showSecretsOnHover,
	    strictImpersonation,
    systemProfile.status,
    twoFAEnabled,
    twoFAMethod,
  ]);

  const groupedProfileSections = useMemo(
    () =>
      profileSections.reduce((groups, section) => {
        groups[section.group] = groups[section.group] || [];
        groups[section.group].push(section);
        return groups;
      }, {}),
    [profileSections]
  );

  useEffect(() => {
    if (!profileSections.length) return;
    if (activeSection && profileSections.some((section) => section.key === activeSection)) return;
    const preferred =
      profileSections.find((section) => section.key === "verificationStatus")?.key || profileSections[0]?.key;
    if (preferred) setActiveSection(preferred);
  }, [activeSection, profileSections]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requestedSection = params.get("section") || params.get("activeSection");
    if (requestedSection && profileSections.some((section) => section.key === requestedSection)) {
      setActiveSection(requestedSection);
    }
  }, [location.search, profileSections]);

  const summaryCards = [
    {
      label: "Account role",
      value: roleOverride || actualRole || "User",
      meta: roleOverride ? `Viewing ${roleOverride}` : "Signed-in role",
    },
    {
      label: "Verification",
      value: emailVerified && phoneVerified ? "Complete" : "Needs action",
      meta: emailVerified ? "Email ready" : "Verify email",
    },
    {
      label: "Security",
      value: twoFAEnabled ? `2FA ${twoFAMethod}` : hasPassword ? "Password only" : "Social login",
      meta:
        authMethods.length > 1
          ? "Multiple sign-in methods"
          : authMethods.includes("google")
          ? "Google-only sign-in"
          : "Local sign-in only",
    },
    {
      label: isPatientProfile ? "Family coverage" : "Workspace language",
      value: isPatientProfile ? `${linkedMinorCount} linked` : selectedLanguageLabel,
      meta: isPatientProfile ? "Managed from this profile" : "Applies across the app",
    },
  ];

  const formatRoleLabel = (value) => String(value || "").replaceAll("_", " ").trim() || "User";
  const requiresDeletePassword = authMethods.includes("local") || hasPassword;
  const deleteReady =
    deleteConfirmText.trim().toUpperCase() === "DELETE MY ACCOUNT" &&
    (!requiresDeletePassword || deletePassword.trim().length > 0);

  const switchWorkspaceRole = (nextRole) => {
    if (!user || !canRoleOverride) return;
    const normalized = normalizeRole(nextRole);
    const signedIn = normalizeRole(user?.actualRole || user?.role || "");
    if (!normalized) {
      setRoleOverride("");
      navigate(redirectByRole({ role: signedIn || user.role }));
      return;
    }
    setRoleOverride(normalized);
    navigate(redirectByRole({ role: normalized }));
  };

  const resetWorkspaceView = () => {
    if (!user || !canRoleOverride) return;
    const signedIn = normalizeRole(user?.actualRole || user?.role || "");
    setRoleOverride("");
    setStrictImpersonation(false);
    navigate(redirectByRole({ role: signedIn || user.role }));
  };

	  const renderActiveSection = () => {
	    switch (activeSection) {
	      case "roleSwitcher":
	        return (
	          <DismissibleSection
	            title="Workspace role view"
	            eyebrow="Administration"
	            className="profile-hero-card"
	            aside={<span className="action-pill">{strictImpersonation ? "Strict mode" : "Founder view"}</span>}
	          >
	            <div className="profile-status-grid" style={{ marginBottom: 12 }}>
	              <div className="profile-status-pill ok">
	                <strong>Signed-in:</strong> {formatRoleLabel(user?.actualRole || user?.role)}
	              </div>
	              <div className="profile-status-pill">
	                <strong>Viewing:</strong> {formatRoleLabel(roleOverride || user?.actualRole || user?.role)}
	              </div>
	            </div>

	            <div className="profile-row profile-actions-row" style={{ marginTop: 12 }}>
	              <select value={roleOverride || ""} onChange={(e) => switchWorkspaceRole(e.target.value)}>
	                <option value="">
	                  Signed-in role ({formatRoleLabel(user?.actualRole || user?.role)})
	                </option>
	                {ROLE_VIEW_OPTIONS.filter(
                  (role) => normalizeRole(role) !== normalizeRole(user?.actualRole || user?.role || "")
                ).map((role) => (
                  <option key={role} value={role}>
                    {formatRoleLabel(role)}
                  </option>
                ))}
              </select>
              <button type="button" className="btn-secondary" onClick={resetWorkspaceView}>
                Reset
              </button>
            </div>

            <label className="profile-inline-check" style={{ marginTop: 12 }}>
              <input
                type="checkbox"
                checked={Boolean(strictImpersonation)}
                onChange={(e) => setStrictImpersonation(e.target.checked)}
              />
              <span>Strict impersonation</span>
            </label>
          </DismissibleSection>
        );
      case "verificationStatus":
        return (
          <DismissibleSection
            title="Verification Status"
            eyebrow="Account"
            aside={<span className={`action-pill ${emailVerified && phoneVerified ? "ok" : ""}`}>{emailVerified && phoneVerified ? "Ready" : "Attention"}</span>}
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
        );
      case "phoneVerification":
        return (
          <DismissibleSection
            title="Phone Verification"
            eyebrow="Account"
            aside={<span className="action-pill">{phoneVerified ? "Verified" : "OTP needed"}</span>}
          >
            <p className="muted">
              {phoneVerified
                ? "Your phone number is verified."
                : "Verify your phone number to keep your account active and unlock OTP-based security features."}
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
              <button
                type="button"
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
              <button
                type="button"
                className="success"
                onClick={verifyPhoneOtp}
                disabled={phoneBusy || !phoneOtp.trim()}
              >
                {phoneBusy ? "Verifying..." : "Verify"}
              </button>
            </div>
            {phoneMsg && <p style={{ marginTop: 8 }}>{phoneMsg}</p>}
          </DismissibleSection>
        );

      case "nationalId":
        {
          const locked = isSectionLocked("nationalId");
        return (
          <EditableSection
            title="National ID"
            eyebrow="Account"
            saved={sectionSaved.nationalId}
            editing={sectionEditing.nationalId}
            saving={idSaving}
            onEdit={() => beginSectionEdit("nationalId")}
            onSave={saveNationalId}
            onCancel={() => setSectionEditing((prev) => ({ ...prev, nationalId: false }))}
            saveLabel="Save National ID"
            message={idMsg}
            aside={<span className="action-pill">{idNumber ? "On file" : "Missing"}</span>}
          >
            <label>National ID Number</label>
            <input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} disabled={locked} />

            <label>National ID Country</label>
            <select value={idCountry} onChange={(e) => setIdCountry(e.target.value)} disabled={locked}>
              <option value="">Select country</option>
              {countries.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name} ({country.code})
                </option>
              ))}
            </select>
          </EditableSection>
        );
        }

      case "professionalLicense":
        {
          const locked = isSectionLocked("professionalLicense");
        return (
          <EditableSection
            title="Professional License"
            eyebrow="Account"
            saved={sectionSaved.professionalLicense}
            editing={sectionEditing.professionalLicense}
            saving={licenseSaving}
            onEdit={() => beginSectionEdit("professionalLicense")}
            onSave={saveLicense}
            onCancel={() => setSectionEditing((prev) => ({ ...prev, professionalLicense: false }))}
            saveLabel="Save License"
            message={licenseMsg}
            aside={<span className="action-pill">{licenseNumber ? "On file" : "Optional"}</span>}
          >
            <label>Professional License Number</label>
            <input
              value={licenseNumber}
              onChange={(e) => setLicenseNumber(e.target.value)}
              placeholder="e.g. KMPDC-123456"
              disabled={locked}
            />

            <label>License Expiry Date</label>
            <input type="date" value={licenseExpiry} onChange={(e) => setLicenseExpiry(e.target.value)} disabled={locked} />
          </EditableSection>
        );
        }
      case "accessibility":
        return (
          <DismissibleSection
            title="Display & Accessibility"
            eyebrow="Preferences"
            aside={<span className="action-pill">{selectedLanguageLabel}</span>}
          >
            <div className="display-settings-hero">
              <div>
                <div className="display-settings-kicker">Personal workspace</div>
                <strong>Set your app language once here and tune readability for the entire signed-in experience.</strong>
                <p className="muted">
                  Changes apply immediately across your sidebar, dashboards, cards, forms, and the rest of your account.
                </p>
              </div>
              <div className="display-settings-status">
                <span className="action-pill">Current language: {selectedLanguageLabel}</span>
                <span className="action-pill">Live preview enabled</span>
              </div>
            </div>

            <div className="display-settings-grid">
              <div className="display-settings-card profile-language-setting">
                <div className="display-settings-card-head">
                  <div>
                    <h4>Preferred app language</h4>
                    <p className="muted">
                      This controls the sidebar, dashboard, cards, and the rest of the signed-in app.
                    </p>
                  </div>
                  <span className="action-pill">Account wide</span>
                </div>
                <LanguageSwitcher className="profile-language-switcher" />
              </div>

              <div className="display-settings-card">
                <div className="display-settings-card-head">
                  <div>
                    <h4>Reading comfort</h4>
                    <p className="muted">
                      Fine-tune spacing and text density so the product stays easy to scan on any screen.
                    </p>
                  </div>
                </div>

                <div className="display-settings-controls">
                  <label className="display-settings-control">
                    <span>Text size</span>
                    <select
                      value={a11yPrefs.textSize}
                      onChange={(e) => updateA11yPref("textSize", e.target.value)}
                    >
                      <option value="small">Small</option>
                      <option value="normal">Normal</option>
                      <option value="large">Large</option>
                      <option value="extra-large">Extra Large</option>
                    </select>
                  </label>

                  <label className="display-settings-control">
                    <span>Text spacing</span>
                    <select
                      value={a11yPrefs.textSpacing}
                      onChange={(e) => updateA11yPref("textSpacing", e.target.value)}
                    >
                      <option value="compact">Compact</option>
                      <option value="normal">Normal</option>
                      <option value="relaxed">Relaxed</option>
                    </select>
                  </label>

                  <label className="display-settings-control">
                    <span>Input size</span>
                    <select
                      value={a11yPrefs.inputSize}
                      onChange={(e) => updateA11yPref("inputSize", e.target.value)}
                    >
                      <option value="compact">Compact</option>
                      <option value="normal">Normal</option>
                      <option value="large">Large</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>

            <div className="profile-row profile-actions-row">
              <button type="button" className="secondary" onClick={resetA11yPrefs}>
                Reset Display Defaults
              </button>
            </div>
          </DismissibleSection>
        );
      case "adminPreferences":
        return (
          <DismissibleSection
            title="Admin Preferences"
            eyebrow="Administration"
            aside={<span className="action-pill">{showSecretsOnHover ? "Hover reveal" : "Standard"}</span>}
          >
            <p className="muted">Control admin-only UI behavior across the platform.</p>
            <label className="muted" style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
              <input
                type="checkbox"
                checked={showSecretsOnHover}
                onChange={(e) => updateShowSecretsPref(e.target.checked)}
                disabled={uiPrefSaving}
              />
              Show sensitive tokens on hover (Integration Control Plane)
            </label>
            {uiPrefMsg ? <p style={{ marginTop: 8 }}>{uiPrefMsg}</p> : null}
          </DismissibleSection>
        );
      case "basicInfo": {
        const locked = isSectionLocked("basicInfo");
        return (
          <EditableSection
            title="Personal Information"
            eyebrow="Account"
            className={locked ? "profile-section-locked" : ""}
            saved={sectionSaved.basicInfo}
            editing={sectionEditing.basicInfo}
            saving={sectionSaving.basicInfo}
            onEdit={() => beginSectionEdit("basicInfo")}
            onSave={() => saveExtendedProfile("basicInfo")}
            onCancel={() => setSectionEditing((prev) => ({ ...prev, basicInfo: false }))}
            saveLabel="Save Basic Info"
            message={sectionMsg.basicInfo}
            aside={<span className="action-pill">{sectionSaving.basicInfo ? "Saving" : "Profile data"}</span>}
          >
            <label>Gender</label>
            <select value={basic.gender} onChange={(e) => setBasic({ ...basic, gender: e.target.value })} disabled={locked}>
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
              disabled={locked}
            />
            <label>Nationality</label>
            <select
              value={basic.nationality}
              onChange={(e) => setBasic({ ...basic, nationality: e.target.value })}
              disabled={locked}
            >
              <option value="">Select country</option>
              {countries.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name} ({country.code})
                </option>
              ))}
            </select>
            <label>Address</label>
            <input value={basic.address} onChange={(e) => setBasic({ ...basic, address: e.target.value })} disabled={locked} />
            <label>Emergency Contact Name</label>
            <input value={basic.emergencyName} onChange={(e) => setBasic({ ...basic, emergencyName: e.target.value })} disabled={locked} />
            <label>Emergency Contact Relationship</label>
            <input
              value={basic.emergencyRelationship}
              onChange={(e) => setBasic({ ...basic, emergencyRelationship: e.target.value })}
              disabled={locked}
            />
            <label>Emergency Contact Phone</label>
            <input
              value={basic.emergencyPhone}
              onChange={(e) => setBasic({ ...basic, emergencyPhone: e.target.value })}
              disabled={locked}
            />
          </EditableSection>
        );
      }
      case "employmentInfo": {
        const locked = isSectionLocked("employmentInfo");
        return (
          <EditableSection
            title="Employment Information"
            eyebrow="Professional"
            className={locked ? "profile-section-locked" : ""}
            saved={sectionSaved.employmentInfo}
            editing={sectionEditing.employmentInfo}
            saving={sectionSaving.employmentInfo}
            onEdit={() => beginSectionEdit("employmentInfo")}
            onSave={() => saveExtendedProfile("employmentInfo")}
            onCancel={() => setSectionEditing((prev) => ({ ...prev, employmentInfo: false }))}
            saveLabel="Save Employment Info"
            message={sectionMsg.employmentInfo}
            aside={<span className="action-pill">{employment.department || "Staff profile"}</span>}
          >
            <label>Employee ID</label>
            <input
              value={employment.employeeId}
              onChange={(e) => setEmployment({ ...employment, employeeId: e.target.value })}
              disabled={locked}
            />
            <label>Department</label>
            <select
              value={employment.department}
              onChange={(e) => setEmployment({ ...employment, department: e.target.value })}
              disabled={locked}
            >
              <option value="">Select department</option>
              {DEPARTMENT_OPTIONS.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
            <label>Reporting Manager</label>
            <input
              value={employment.reportingManager}
              onChange={(e) => setEmployment({ ...employment, reportingManager: e.target.value })}
              disabled={locked}
            />
            <label>Employment Type</label>
            <select
              value={employment.employmentType}
              onChange={(e) => setEmployment({ ...employment, employmentType: e.target.value })}
              disabled={locked}
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
              disabled={locked}
            />
            <label>Contract Start</label>
            <input
              type="date"
              value={employment.contractStart}
              onChange={(e) => setEmployment({ ...employment, contractStart: e.target.value })}
              disabled={locked}
            />
            <label>Contract End</label>
            <input
              type="date"
              value={employment.contractEnd}
              onChange={(e) => setEmployment({ ...employment, contractEnd: e.target.value })}
              disabled={locked}
            />
            <label>Work Location</label>
            <input
              value={employment.workLocation}
              onChange={(e) => setEmployment({ ...employment, workLocation: e.target.value })}
              disabled={locked}
            />
            <label>Branch</label>
            <input value={employment.branch} onChange={(e) => setEmployment({ ...employment, branch: e.target.value })} disabled={locked} />
          </EditableSection>
        );
      }
      case "credentialsInfo": {
        const locked = isSectionLocked("credentialsInfo");
        return (
          <EditableSection
            title="Credentials & Professional Data"
            eyebrow="Professional"
            className={locked ? "profile-section-locked" : ""}
            saved={sectionSaved.credentialsInfo}
            editing={sectionEditing.credentialsInfo}
            saving={sectionSaving.credentialsInfo}
            onEdit={() => beginSectionEdit("credentialsInfo")}
            onSave={() => saveExtendedProfile("credentialsInfo")}
            onCancel={() => setSectionEditing((prev) => ({ ...prev, credentialsInfo: false }))}
            saveLabel="Save Credentials"
            message={sectionMsg.credentialsInfo}
            aside={<span className="action-pill">{credentials.specialization || "Pending"}</span>}
          >
            <label>Specialization</label>
            <input
              value={credentials.specialization}
              onChange={(e) => setCredentials({ ...credentials, specialization: e.target.value })}
              disabled={locked}
            />
            <label>Sub-specialization</label>
            <input
              value={credentials.subSpecialization}
              onChange={(e) => setCredentials({ ...credentials, subSpecialization: e.target.value })}
              disabled={locked}
            />
            <label>Certifications (comma-separated)</label>
            <input
              value={credentials.certifications}
              onChange={(e) => setCredentials({ ...credentials, certifications: e.target.value })}
              disabled={locked}
            />
            <label>Education History (comma-separated)</label>
            <input
              value={credentials.educationHistory}
              onChange={(e) => setCredentials({ ...credentials, educationHistory: e.target.value })}
              disabled={locked}
            />
            <label>CME Credits</label>
            <input
              type="number"
              value={credentials.cmeCredits}
              onChange={(e) => setCredentials({ ...credentials, cmeCredits: e.target.value })}
              disabled={locked}
            />
            <label>Research Publications</label>
            <input
              type="number"
              value={credentials.researchPublications}
              onChange={(e) => setCredentials({ ...credentials, researchPublications: e.target.value })}
              disabled={locked}
            />
            <label>Test Authorization Level</label>
            <input
              value={credentials.testAuthorizationLevel}
              onChange={(e) => setCredentials({ ...credentials, testAuthorizationLevel: e.target.value })}
              disabled={locked}
            />
          </EditableSection>
        );
      }
      case "financialInfo": {
        const locked = isSectionLocked("financialInfo");
        return (
          <EditableSection
            title="Financial Information"
            eyebrow="Professional"
            className={locked ? "profile-section-locked" : ""}
            saved={sectionSaved.financialInfo}
            editing={sectionEditing.financialInfo}
            saving={sectionSaving.financialInfo}
            onEdit={() => beginSectionEdit("financialInfo")}
            onSave={() => saveExtendedProfile("financialInfo")}
            onCancel={() => setSectionEditing((prev) => ({ ...prev, financialInfo: false }))}
            saveLabel="Save Financial Info"
            message={sectionMsg.financialInfo}
            aside={<span className="action-pill">{financial.bankName || "Payroll"}</span>}
          >
            <label>Bank Name</label>
            <input value={financial.bankName} onChange={(e) => setFinancial({ ...financial, bankName: e.target.value })} disabled={locked} />
            <label>Bank Account Name</label>
            <input
              value={financial.bankAccountName}
              onChange={(e) => setFinancial({ ...financial, bankAccountName: e.target.value })}
              disabled={locked}
            />
            <label>Bank Account Number</label>
            <input
              value={financial.bankAccountNumber}
              onChange={(e) => setFinancial({ ...financial, bankAccountNumber: e.target.value })}
              disabled={locked}
            />
            <label>Bank Branch</label>
            <input value={financial.bankBranch} onChange={(e) => setFinancial({ ...financial, bankBranch: e.target.value })} disabled={locked} />
            <label>Tax ID</label>
            <input value={financial.taxId} onChange={(e) => setFinancial({ ...financial, taxId: e.target.value })} disabled={locked} />
            <label>Pension Info</label>
            <input
              value={financial.pensionInfo}
              onChange={(e) => setFinancial({ ...financial, pensionInfo: e.target.value })}
              disabled={locked}
            />
            <label>Salary Structure</label>
            <input
              value={financial.salaryStructure}
              onChange={(e) => setFinancial({ ...financial, salaryStructure: e.target.value })}
              disabled={locked}
            />
            <label>Allowances</label>
            <input
              type="number"
              value={financial.allowances}
              onChange={(e) => setFinancial({ ...financial, allowances: e.target.value })}
              disabled={locked}
            />
            <label>Deductions</label>
            <input
              type="number"
              value={financial.deductions}
              onChange={(e) => setFinancial({ ...financial, deductions: e.target.value })}
              disabled={locked}
            />
          </EditableSection>
        );
      }
      case "insuranceProfile": {
        const locked = isSectionLocked("insuranceProfile");
        return (
          <EditableSection
            title="Insurance Profile"
            eyebrow="Care & Coverage"
            className={locked ? "profile-section-locked" : ""}
            saved={sectionSaved.insuranceProfile}
            editing={sectionEditing.insuranceProfile}
            saving={sectionSaving.insuranceProfile}
            onEdit={() => beginSectionEdit("insuranceProfile")}
            onSave={() => saveExtendedProfile("insuranceProfile")}
            onCancel={() => setSectionEditing((prev) => ({ ...prev, insuranceProfile: false }))}
            saveLabel="Save Insurance Profile"
            message={sectionMsg.insuranceProfile}
            aside={<span className="action-pill">{insurance.status}</span>}
          >
            <label>Provider Code</label>
            <input
              value={insurance.providerCode}
              onChange={(e) => setInsurance({ ...insurance, providerCode: e.target.value.toUpperCase() })}
              placeholder="SHA, NHIF, PRIVATE_X"
              disabled={locked}
            />
            <label>Provider Name</label>
            <input value={insurance.providerName} onChange={(e) => setInsurance({ ...insurance, providerName: e.target.value })} disabled={locked} />
            <label>Member Number</label>
            <input value={insurance.memberNumber} onChange={(e) => setInsurance({ ...insurance, memberNumber: e.target.value })} disabled={locked} />
            <label>Balance</label>
            <input type="number" value={insurance.balance} onChange={(e) => setInsurance({ ...insurance, balance: e.target.value })} disabled={locked} />
            <label>Currency</label>
            <input
              value={insurance.currency}
              onChange={(e) => setInsurance({ ...insurance, currency: e.target.value.toUpperCase() })}
              disabled={locked}
            />
            <label>Status</label>
            <select value={insurance.status} onChange={(e) => setInsurance({ ...insurance, status: e.target.value })} disabled={locked}>
              <option value="PENDING">Pending</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </EditableSection>
        );
      }
      case "familyPreferences":
        return (
          <DismissibleSection
            title="Family Preferences"
            eyebrow="Care & Coverage"
            aside={<span className="action-pill">{linkedMinorCount ? `${linkedMinorCount} linked` : "No links"}</span>}
          >
            <p className="muted">
              Link minors under 18 to your account so their appointments, encounters, and medical record trail can be monitored from one parent or guardian login.
            </p>
            <label className="muted" style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
              <input
                type="checkbox"
                checked={familyPrefs.receiveMinorAlerts}
                onChange={(e) => setFamilyPrefs((prev) => ({ ...prev, receiveMinorAlerts: e.target.checked }))}
              />
              Receive alerts for linked children
            </label>
            <label className="muted" style={{ display: "inline-flex", alignItems: "center", gap: "10px", marginTop: 8 }}>
              <input
                type="checkbox"
                checked={familyPrefs.showDailyMinorSummary}
                onChange={(e) => setFamilyPrefs((prev) => ({ ...prev, showDailyMinorSummary: e.target.checked }))}
              />
              Show linked children summary on patient dashboards
            </label>
            <div className="profile-row profile-actions-row" style={{ marginTop: 10 }}>
              <button type="button" className="secondary" onClick={saveFamilyPreferences} disabled={familyBusy}>
                {familyBusy ? "Saving..." : "Save Family Preferences"}
              </button>
              <button type="button" className="secondary" onClick={refreshFamilyMonitoring} disabled={familyBusy}>
                Refresh Linked Children
              </button>
            </div>
            {familyMsg ? <p style={{ marginTop: 8 }}>{familyMsg}</p> : null}
          </DismissibleSection>
        );

      case "familyLinkChild":
        return (
          <DismissibleSection
            title="Link a Child"
            eyebrow="Care & Coverage"
            aside={<span className="action-pill">{familyBusy ? "Working" : "Search"}</span>}
          >
            <p className="muted">
              Search for a minor profile in your hospital scope and link them to your account.
            </p>

            <label>Child name</label>
            <input
              value={familySearch.q}
              onChange={(e) => setFamilySearch((prev) => ({ ...prev, q: e.target.value }))}
              placeholder="Enter first or last name"
            />
            <label>Child date of birth</label>
            <input
              type="date"
              value={familySearch.dob}
              onChange={(e) => setFamilySearch((prev) => ({ ...prev, dob: e.target.value }))}
            />
            <label>Relationship</label>
            <select
              value={familySearch.relationship}
              onChange={(e) => setFamilySearch((prev) => ({ ...prev, relationship: e.target.value }))}
            >
              <option value="PARENT">Parent</option>
              <option value="GUARDIAN">Guardian</option>
              <option value="CAREGIVER">Caregiver</option>
            </select>
            <label>Notes</label>
            <input
              value={familySearch.notes}
              onChange={(e) => setFamilySearch((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Optional note for the care team"
            />
            <div className="profile-row profile-actions-row" style={{ marginTop: 10 }}>
              <button type="button" className="primary" onClick={searchMinorProfiles} disabled={familyBusy}>
                {familyBusy ? "Working..." : "Find Child Profile"}
              </button>
              <button type="button" className="secondary" onClick={refreshFamilyMonitoring} disabled={familyBusy}>
                Refresh Linked Children
              </button>
            </div>
            {familyMsg ? <p style={{ marginTop: 8 }}>{familyMsg}</p> : null}

            {familyResults.length ? (
              <div style={{ marginTop: 14 }}>
                <h4 style={{ marginBottom: 8 }}>Matching Minor Profiles</h4>
                <div className="panel-grid">
                  {familyResults.map((item) => (
                    <div key={item.patientId} className="card">
                      <strong>{item.name}</strong>
                      <p className="muted" style={{ marginTop: 6 }}>
                        Age {item.age ?? "—"} • {item.gender || "Unspecified"} • {item.hospitalName || "Hospital not set"}
                      </p>
                      <p className="muted">DOB: {item.dob ? String(item.dob).slice(0, 10) : "-"}</p>
                      <button
                        type="button"
                        className={item.alreadyLinked ? "secondary" : "primary"}
                        disabled={familyBusy || item.alreadyLinked}
                        onClick={() => linkMinorProfile(item.patientId)}
                      >
                        {item.alreadyLinked ? "Already Linked" : "Link to My Account"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </DismissibleSection>
        );

      case "familyLinkedChildren":
        return (
          <DismissibleSection
            title="Linked Children"
            eyebrow="Care & Coverage"
            aside={<span className="action-pill">{linkedMinorCount ? `${linkedMinorCount} linked` : "None"}</span>}
          >
            <div className="profile-row profile-actions-row" style={{ marginTop: 2 }}>
              <button type="button" className="secondary" onClick={refreshFamilyMonitoring} disabled={familyBusy}>
                {familyBusy ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            {linkedMinors.length ? (
              <div className="panel-grid" style={{ marginTop: 14 }}>
                {linkedMinors.map((item) => (
                  <div key={item.patientId} className="card">
                    <div className="profile-row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      <div>
                        <strong>{item.name}</strong>
                        <p className="muted" style={{ marginTop: 6 }}>
                          {item.relationship || "Parent"} • Age {item.age ?? "—"} • {item.hospitalName || "Hospital not set"}
                        </p>
                        {item.consentPolicy ? (
                          <p className="muted" style={{ marginTop: 6 }}>
                            {item.consentPolicy.mode === "SHARED_TEEN_ACCESS"
                              ? `Teen shared access active (${item.consentPolicy.countryCode}).`
                              : `Parent proxy access active (${item.consentPolicy.countryCode}).`}
                          </p>
                        ) : null}
                      </div>
                      <button type="button" className="danger" onClick={() => unlinkMinorProfile(item.patientId)} disabled={familyBusy}>
                        Remove
                      </button>
                    </div>
                    <p className="muted" style={{ marginTop: 8 }}>
                      Upcoming appointments: {item.upcomingAppointments} • Encounters: {item.totalEncounters} • Records: {item.medicalRecordsCount}
                    </p>
                    <p className="muted">
                      Latest diagnosis: {item.consentPolicy?.permissions?.detailedClinicalNotes === false
                        ? "Detailed teen clinical notes are hidden in shared-access mode."
                        : item.latestDiagnosis || "No diagnosis captured yet"}
                    </p>
                    <p className="muted">
                      Latest appointment: {item.latestAppointmentAt ? new Date(item.latestAppointmentAt).toLocaleString() : "None yet"}
                    </p>
                    {item.notes ? <p className="muted">Notes: {item.notes}</p> : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted" style={{ marginTop: 12 }}>No linked children yet.</p>
            )}
          </DismissibleSection>
        );
      case "systemData": {
        const locked = isSectionLocked("systemData");
        return (
          <EditableSection
            title="System Data"
            eyebrow="Administration"
            className={locked ? "profile-section-locked" : ""}
            saved={sectionSaved.systemData}
            editing={sectionEditing.systemData}
            saving={sectionSaving.systemData}
            onEdit={() => beginSectionEdit("systemData")}
            onSave={() => saveExtendedProfile("systemData")}
            onCancel={() => setSectionEditing((prev) => ({ ...prev, systemData: false }))}
            saveLabel="Save System Data"
            message={sectionMsg.systemData}
            aside={<span className="action-pill">{systemProfile.status}</span>}
          >
            <label>Status</label>
            <select
              value={systemProfile.status}
              onChange={(e) => setSystemProfile({ ...systemProfile, status: e.target.value })}
              disabled={locked}
            >
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="ON_LEAVE">On Leave</option>
            </select>
            <label>Access Expiration</label>
            <input
              type="date"
              value={systemProfile.accessExpiresAt}
              onChange={(e) => setSystemProfile({ ...systemProfile, accessExpiresAt: e.target.value })}
              disabled={locked}
            />
          </EditableSection>
        );
      }
      case "roleChecklist":
        return (
          <DismissibleSection
            title={`Role-Specific Profile Checklist (${user?.role})`}
            eyebrow="Professional"
            aside={<span className="action-pill">{user?.role}</span>}
          >
            <ul>
              {(roleProfileHints[user?.role] || roleProfileHints.GUEST).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </DismissibleSection>
        );
      case "trainingGuide":
        return (
          <DismissibleSection
            title="AfyaLink Training Notes"
            eyebrow="Professional"
            aside={<span className="action-pill">{resolvedTrainingRole}</span>}
          >
            <p className="muted">Use these notes to train this role quickly and consistently.</p>
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
              <DownloadMenu
                label="Download Notes"
                options={[
                  { value: "txt", label: "Download .txt", onClick: () => exportTrainingNotes("txt") },
                  { value: "doc", label: "Download .doc (Word)", onClick: () => exportTrainingNotes("doc") },
                  { value: "html", label: "Download .html", onClick: () => exportTrainingNotes("html") },
                  { value: "pdf", label: "Export PDF", onClick: () => exportTrainingNotes("pdf") },
                ]}
              />
              <button type="button" className="secondary" onClick={printTrainingNotes}>
                Print Notes
              </button>
            </div>
            <div className="profile-row profile-actions-row" style={{ marginTop: 8 }}>
              <button type="button" className="secondary" onClick={copyMasterTrainingNotes}>
                Copy Full Playbook
              </button>
              <DownloadMenu
                label="Download Full Playbook"
                options={[
                  { value: "txt", label: "Download .txt", onClick: () => exportMasterTrainingNotes("txt") },
                  { value: "doc", label: "Download .doc (Word)", onClick: () => exportMasterTrainingNotes("doc") },
                  { value: "html", label: "Download .html", onClick: () => exportMasterTrainingNotes("html") },
                  { value: "pdf", label: "Export PDF", onClick: () => exportMasterTrainingNotes("pdf") },
                ]}
              />
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
                    <strong>
                      {w.day}: {w.title}
                    </strong>
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
        );
      case "twoFactor":
        return (
          <DismissibleSection
            title="Two-Factor Authentication (2FA)"
            eyebrow="Access & Security"
            aside={<span className="action-pill">{twoFAEnabled ? twoFAMethod : "Disabled"}</span>}
          >
            <p>
              {twoFAEnabled
                ? "2FA is enabled. You’ll be asked for a code at login."
                : "2FA is disabled. Your account uses password only."}
            </p>
            <p className="muted">Current method: {twoFAMethod}</p>
            <button type="button" className={twoFAEnabled ? "danger" : "success"} onClick={toggle2FA}>
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
                <input value={totpCode} onChange={(e) => setTotpCode(e.target.value)} placeholder="6-digit code" />
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
                <div style={{ marginTop: 6 }}>{recoveryCodes.join(" • ")}</div>
              </div>
            )}
            {twoFAMsg ? <p className="muted" style={{ marginTop: 8 }}>{twoFAMsg}</p> : null}
          </DismissibleSection>
        );
      case "password":
        return (
          <DismissibleSection
            title="Password & Login"
            eyebrow="Access & Security"
            aside={<span className="action-pill">{hasPassword ? "Password ready" : "Set password"}</span>}
          >
            {pwError && <div className="auth-error">{pwError}</div>}
            {pwMessage && <div className="auth-success">{pwMessage}</div>}
            {(!authMethods.includes("local") || !authMethods.includes("google")) && (
              <div className="subtle-banner" style={{ marginBottom: 12 }}>
                <strong>Manage your sign-in methods.</strong>
                <div style={{ marginTop: 6 }}>
                  {authMethods.includes("local") && authMethods.includes("google")
                    ? "Your account can sign in with both Google and password. Use the button below to add or refresh linked methods."
                    : authMethods.includes("google")
                    ? "Your account is currently Google-only. Create a password here to enable direct email/phone sign-in."
                    : "Your account is currently password-based. Link Google for faster login and account recovery."}
                </div>
              </div>
            )}

            <div className="auth-detail-grid" style={{ marginBottom: 16 }}>
              <div className="auth-detail-card">
                <strong>Linked methods</strong>
                <span>{authMethods.join(" + ")}</span>
              </div>
              <div className="auth-detail-card">
                <strong>Backup login</strong>
                <span>{hasPassword ? "Password available" : "Password not set"}</span>
              </div>
            </div>

            {authMethods.includes("google") ? (
              <div className="auth-detail-card subtle-banner" style={{ marginBottom: 12 }}>
                <strong>Google access is linked</strong>
                <div className="muted" style={{ marginTop: 6 }}>
                  You can continue signing in with Google and keep a password as a backup method.
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: 14 }}>
                <strong>Link Google sign-in</strong>
                <p className="muted" style={{ margin: "8px 0 12px" }}>
                  Connect Google to this account so you can sign in faster and recover access from the same email.
                </p>
                <div
                  onClick={() => {
                    setGoogleLinkMessage("");
                    setGoogleLinkError("");
                    clearGoogleButtonError?.();
                  }}
                >
                  <GoogleButton />
                </div>
                {googleLinkError ? <div className="auth-error">{googleLinkError}</div> : null}
                {googleLinkMessage ? <div className="auth-success-panel">{googleLinkMessage}</div> : null}
              </div>
            )}

            <form className="form" onSubmit={handlePasswordChange}>
              {!(authMethods.includes("google") && !authMethods.includes("local") && !hasPassword) && (
                <PasswordInput
                  label="Current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              )}

              <PasswordInput
                label={
                  authMethods.includes("google") && !authMethods.includes("local") && !hasPassword
                    ? "Create password"
                    : "New password"
                }
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
                showStrength
              />

              <PasswordInput
                label="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />

              <button className="btn-primary" type="submit" disabled={pwLoading} style={{ marginTop: 8 }}>
                {pwLoading
                  ? "Updating..."
                  : authMethods.includes("google") && !authMethods.includes("local") && !hasPassword
                    ? "Set password"
                    : "Change password"}
              </button>
            </form>
          </DismissibleSection>
        );
      case "privacyData":
        return (
          <DismissibleSection
            title="Privacy & Data"
            eyebrow="Privacy & Legal"
            aside={<span className="action-pill">Controls</span>}
          >
            <p className="muted">
              Download a machine-readable copy of your account data, review the legal documents that apply to this
              service, or permanently delete your account.
            </p>

            <div className="auth-detail-grid">
              <div className="auth-detail-card">
                <strong>Export</strong>
                <span>Download a JSON export of your account profile and linked device history.</span>
              </div>
              <div className="auth-detail-card">
                <strong>Legal</strong>
                <span>Open the current Privacy Policy and Terms of Service from this settings area.</span>
              </div>
            </div>

            {privacyError ? <div className="auth-error">{privacyError}</div> : null}
            {privacyMsg ? <div className="auth-success-panel">{privacyMsg}</div> : null}

            <div className="auth-inline-links">
              <Link className="btn-secondary" to="/privacy">
                Privacy Policy
              </Link>
              <Link className="btn-secondary" to="/terms">
                Terms of Service
              </Link>
            </div>

            <div className="profile-row profile-actions-row">
              <button
                type="button"
                className="btn-secondary"
                onClick={downloadAccountExport}
                disabled={exportBusy}
              >
                {exportBusy ? "Preparing export..." : "Export My Data"}
              </button>
            </div>

            <div className="privacy-danger-panel">
              <div className="privacy-danger-copy">
                <strong>Delete account</strong>
                <p className="muted">
                  This immediately disables sign-in for this account and removes direct identifiers where the platform
                  no longer needs them.
                </p>
              </div>

              <label htmlFor="delete-account-confirmation">Confirmation</label>
              <input
                id="delete-account-confirmation"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder='Type "DELETE MY ACCOUNT"'
                autoComplete="off"
              />

              {requiresDeletePassword ? (
                <PasswordInput
                  id="delete-account-password"
                  label="Current password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  helperText="Required before this account can be deleted."
                  autoComplete="current-password"
                />
              ) : null}

              <div className="profile-row profile-actions-row">
                <button type="button" className="danger" onClick={deleteAccount} disabled={deleteBusy || !deleteReady}>
                  {deleteBusy ? "Deleting..." : "Delete Account"}
                </button>
              </div>
            </div>
          </DismissibleSection>
        );
      default:
        return (
          <div className="card premium-card profile-settings-empty">
            <h3>Choose a settings category</h3>
            <p className="muted">Pick a section from the left to open the matching profile workspace.</p>
          </div>
        );
    }
  };

  const stageContent = profileLoaded ? (
    renderActiveSection()
  ) : (
    <div className="card premium-card profile-settings-loading">
      <h2>{loading ? "Loading your workspace" : "Workspace still warming up"}</h2>
      <p className="muted">
        {loading
          ? "Pulling your account, security, and role-specific settings."
          : error || "We could not load your profile settings yet. Please try again."}
      </p>
      <div className="profile-row profile-actions-row" style={{ marginTop: 12 }}>
        <button type="button" className="primary" onClick={() => loadStatus(1)} disabled={loading}>
          {loading ? "Loading..." : "Try again"}
        </button>
      </div>
    </div>
  );

	  return (
	    <div className="profile-container profile-settings-home">
	      {profileLoaded ? renderVerificationWarning() : null}

      <section className="card premium-card profile-settings-hero">
        <div className="profile-settings-hero-copy">
          <div className="profile-panel-eyebrow">Profile</div>
          <h1>{user?.name || "Your profile workspace"}</h1>
          <p className="muted">
            {profileUserId || user?.userId ? (
              <span>
                Account ID: <strong>{profileUserId || user?.userId}</strong>
                <button type="button" className="btn-secondary" style={{ marginLeft: 10 }} onClick={copyAccountId}>
                  {copyIdMsg || "Copy"}
                </button>
              </span>
            ) : (
              "Open one focused settings panel at a time. Everything here applies immediately to your account and keeps the profile experience cleaner than a long stacked page."
            )}
          </p>
        </div>
        <div className="profile-settings-hero-pills">
          <span className="action-pill">{roleOverride ? `Viewing ${roleOverride}` : actualRole}</span>
          <span className="action-pill">
            {authMethods.includes("google") && authMethods.includes("local")
              ? "Google + Local"
              : authMethods.includes("google")
              ? "Google sign-in"
              : "Local sign-in"}
          </span>
          <span className="action-pill">{selectedLanguageLabel}</span>
          {syncing ? <span className="action-pill">Syncing…</span> : null}
        </div>
      </section>

      {profileLoaded && error ? (
        <div className="card premium-card subtle-banner" style={{ marginTop: 16 }}>
          <strong>Last sync failed.</strong>
          <div className="muted" style={{ marginTop: 6 }}>
            {error}
          </div>
        </div>
      ) : null}

      <div className="profile-settings-summary-grid">
        {summaryCards.map((item) => (
          <div key={item.label} className="card profile-settings-summary-card">
            <span className="profile-settings-summary-label">{item.label}</span>
            <strong>{item.value}</strong>
            <p className="muted">{item.meta}</p>
          </div>
        ))}
      </div>

	      <div className="profile-settings-shell">
	        <aside className="card profile-settings-nav">
	          {Object.entries(groupedProfileSections).map(([group, sections]) => (
	            <div key={group} className="profile-settings-nav-group">
	              <div className="profile-settings-nav-title">{group}</div>
	              <div className="profile-settings-nav-list">
	                {sections.map((section) => (
	                  <button
	                    key={section.key}
	                    type="button"
	                    className={`profile-settings-nav-button ${activeSection === section.key ? "active" : ""}`.trim()}
	                    title={section.description}
	                    onClick={() => setActiveSection(section.key)}
	                  >
	                    <span className="profile-settings-nav-button-head">
	                      <strong>{section.title}</strong>
	                      <span className="action-pill">{section.badge}</span>
	                    </span>
	                  </button>
	                ))}
	              </div>
	            </div>
	          ))}
	        </aside>

	        <section className="profile-settings-stage">
	          {stageContent}
	        </section>
	      </div>
	    </div>
	  );
	}
