// frontend/src/pages/Profile.jsx
import { useEffect, useState } from "react";
import { useAuth } from "../utils/auth";
import apiFetch from "../utils/apiFetch";
import { useNavigate } from "react-router-dom";
import { redirectByRole } from "../utils/redirectByRole";

const COOLDOWN_KEY = "verifyCooldownUntil";

export default function Profile() {
  const { user, canRoleOverride, roleOverride, setRoleOverride } = useAuth();
  const navigate = useNavigate();
  const [viewRole, setViewRole] = useState("");

  const viewableRoles = [
    "SUPER_ADMIN",
    "SYSTEM_ADMIN",
    "HOSPITAL_ADMIN",
    "DEVELOPER",
    "DOCTOR",
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
    "PATIENT",
    "GUEST",
  ];

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 2FA
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);

  // Email verification
  const [emailVerified, setEmailVerified] = useState(true);
  const [verificationWarning, setVerificationWarning] = useState(null);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [cooldown, setCooldown] = useState(0);

  // Phone verification + national ID
  const [phone, setPhone] = useState("");
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

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMessage, setPwMessage] = useState("");
  const [pwError, setPwError] = useState("");

  useEffect(() => {
    restoreCooldown();
    loadStatus();
  }, []);

  useEffect(() => {
    setViewRole(roleOverride || user?.actualRole || user?.role || "");
  }, [roleOverride, user?.actualRole, user?.role]);

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

      const me = await apiFetch("/api/profile");
      setEmailVerified(Boolean(me?.emailVerified));
      setPhoneVerified(Boolean(me?.phoneVerified));
      setPhone(me?.phone || "");
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
        },
      });
      setExtendedMsg("Profile details updated.");
    } catch (err) {
      setExtendedMsg(err.message || "Failed to update profile details");
    } finally {
      setExtendedSaving(false);
    }
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
    } catch {
      setError("Failed to update 2FA setting");
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
      await apiFetch("/api/auth/phone/request-otp", {
        method: "POST",
        body: { phone: phone.trim() },
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

  if (loading) return <p>Loading...</p>;

  return (
    <div className="profile-container">
      {canRoleOverride && (
        <div className="card">
          <h3>Role View Switcher</h3>
          <p>
            Use this to switch and test full permissions as different account types.
            Your actual account stays <strong>{user?.actualRole || user?.role}</strong>.
          </p>
          <div className="profile-row">
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
            <button
              className="primary"
              onClick={() => {
                setRoleOverride(viewRole);
                navigate(redirectByRole({ role: viewRole }));
              }}
            >
              Switch Role View
            </button>
            <button
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
        </div>
      )}

      {/* ============================
         EMAIL VERIFICATION
      ============================ */}
      {renderVerificationWarning()}

      {/* ============================
         VERIFICATION STATUS
      ============================ */}
      <div className="card">
        <h3>Verification Status</h3>
        <div className="grid">
          <div>
            <strong>Email:</strong>{" "}
            {emailVerified ? "Verified" : "Not verified"}
          </div>
          <div>
            <strong>Phone:</strong>{" "}
            {phoneVerified ? "Verified" : "Not verified"}
          </div>
        </div>
      </div>

      {/* ============================
         PHONE + NATIONAL ID
      ============================ */}
      <div className="card">
        <h3>Phone & National ID</h3>
        <p>
          {phoneVerified
            ? "Your phone number is verified."
            : "Verify your phone number to keep your account active."}
        </p>

        <label>Phone number</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+1 555 123 4567"
        />
        <div className="profile-row">
          <button
            className="primary"
            onClick={requestPhoneOtp}
            disabled={phoneBusy || !phone.trim()}
          >
            {phoneBusy ? "Sending..." : "Send OTP"}
          </button>

          <input
            value={phoneOtp}
            onChange={(e) => setPhoneOtp(e.target.value)}
            placeholder="Enter OTP"
            style={{ maxWidth: 180 }}
          />
          <button
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
        <input
          value={idCountry}
          onChange={(e) => setIdCountry(e.target.value)}
          placeholder="e.g. KE, US, NG"
        />
        <button
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

        <button
          className="primary"
          onClick={saveLicense}
          disabled={licenseSaving}
          style={{ marginTop: 8 }}
        >
          {licenseSaving ? "Saving..." : "Save License"}
        </button>
        {licenseMsg && <p style={{ marginTop: 8 }}>{licenseMsg}</p>}
      </div>

      <div className="card">
        <h3>Basic Information</h3>
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
        <input
          value={basic.nationality}
          onChange={(e) => setBasic({ ...basic, nationality: e.target.value })}
        />
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
      </div>

      <div className="card">
        <h3>Employment Information</h3>
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
      </div>

      <div className="card">
        <h3>Credentials & Professional Data</h3>
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
      </div>

      <div className="card">
        <h3>Financial Information</h3>
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
      </div>

      <div className="card">
        <h3>System Data</h3>
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
        <button
          className="primary"
          onClick={saveExtendedProfile}
          disabled={extendedSaving}
          style={{ marginTop: 8 }}
        >
          {extendedSaving ? "Saving..." : "Save Full Profile"}
        </button>
        {extendedMsg && <p style={{ marginTop: 8 }}>{extendedMsg}</p>}
      </div>

      <div className="card">
        <h3>Role-Specific Profile Checklist ({user?.role})</h3>
        <ul>
          {(roleProfileHints[user?.role] || roleProfileHints.GUEST).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      {/* ============================
         2FA SECTION
      ============================ */}
      <div className="card">
        <h3>Two-Factor Authentication (2FA)</h3>
        <p>
          {twoFAEnabled
            ? "2FA is enabled. You’ll be asked for a code at login."
            : "2FA is disabled. Your account uses password only."}
        </p>
        <button
          className={twoFAEnabled ? "danger" : "success"}
          onClick={toggle2FA}
        >
          {twoFAEnabled ? "Disable 2FA" : "Enable 2FA"}
        </button>
      </div>

      {/* ============================
         CHANGE PASSWORD SECTION
      ============================ */}
      <div className="card" style={{ marginTop: 24 }}>
        <h3>Change Password</h3>

        {pwError && <div className="auth-error">{pwError}</div>}
        {pwMessage && <div className="auth-success">{pwMessage}</div>}

        <form onSubmit={handlePasswordChange}>
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

          <button disabled={pwLoading} style={{ marginTop: 8 }}>
            {pwLoading ? "Updating..." : "Change password"}
          </button>
        </form>
      </div>

      {error && <p style={{ color: "red", marginTop: 16 }}>{error}</p>}
    </div>
  );
}
