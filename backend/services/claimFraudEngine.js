import crypto from "crypto";
import Claim from "../models/Claim.js";
import ClaimRule from "../models/ClaimRule.js";
import PatientIdentityRegistry from "../models/PatientIdentityRegistry.js";
import GovernmentHospitalRegistry from "../models/GovernmentHospitalRegistry.js";
import { COUNTRY_POLICIES, DEFAULT_CLAIM_RULES } from "../config/claimFraudRules.js";

function normalize(val) {
  return String(val || "").trim().toUpperCase();
}

function addSignal(signals, code, severity, message) {
  signals.push({ code, severity, message });
}

function severityScore(severity) {
  if (severity === "HIGH") return 40;
  if (severity === "MEDIUM") return 20;
  return 10;
}

function ruleMatches(rule, procedure) {
  const code = normalize(procedure.code);
  const category = normalize(procedure.category);
  if (rule.procedureCode && normalize(rule.procedureCode) !== code) return false;
  if (rule.procedureCategory && normalize(rule.procedureCategory) !== category) return false;
  return Boolean(rule.procedureCode || rule.procedureCategory);
}

async function loadRules(country) {
  const countryCode = normalize(country);
  const dbRules = await ClaimRule.find({
    enabled: true,
    $or: [{ country: "" }, { country: countryCode }],
  }).lean();

  const merged = [...DEFAULT_CLAIM_RULES, ...dbRules];
  const dedup = [];
  const seen = new Set();
  for (const rule of merged) {
    const key = [
      normalize(rule.country),
      normalize(rule.ruleType),
      normalize(rule.procedureCode),
      normalize(rule.procedureCategory),
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    dedup.push(rule);
  }
  return dedup;
}

async function checkRegistryMatch(patient, country) {
  const countryCode = normalize(country);
  const idNumber = patient?.nationalId || patient?.countryId;
  if (!idNumber || !countryCode) return false;
  const match = await PatientIdentityRegistry.findOne({
    country: countryCode,
    idNumber: String(idNumber).trim(),
    status: "ACTIVE",
  }).lean();
  return Boolean(match);
}

function procedureKey(patientId, procedure, serviceStart) {
  const key = `${patientId}:${normalize(procedure.code || procedure.category)}:${serviceStart || ""}`;
  return crypto.createHash("sha256").update(key).digest("hex").slice(0, 20);
}

export async function evaluateClaim({ claim, hospital, patient }) {
  const signals = [];
  const country = claim.country || claim.provider?.country || hospital?.location?.country || "";
  const countryCode = normalize(country);
  const policy = COUNTRY_POLICIES[countryCode] || COUNTRY_POLICIES.DEFAULT;
  const now = new Date();

  if (hospital?.verification?.status !== "VERIFIED") {
    addSignal(signals, "HOSPITAL_NOT_VERIFIED", "HIGH", "Hospital verification status is not VERIFIED.");
  }
  if (hospital?.verification?.registryHospital) {
    const registry = await GovernmentHospitalRegistry.findById(hospital.verification.registryHospital).lean();
    if (!registry || registry.status !== "ACTIVE") {
      addSignal(signals, "HOSPITAL_REGISTRY_INACTIVE", "HIGH", "Hospital registry status is not ACTIVE.");
    }
  }

  if (claim.provider?.code) {
    const hasProvider = Array.isArray(hospital?.insuranceProviders)
      && hospital.insuranceProviders.some((p) => normalize(p.code) === normalize(claim.provider.code) && p.enabled !== false);
    if (!hasProvider) {
      addSignal(signals, "PROVIDER_NOT_ENABLED", "HIGH", "Hospital is not enabled for this provider.");
    }
  } else {
    addSignal(signals, "PROVIDER_MISSING", "HIGH", "Claim provider is required.");
  }

  let registryMatch = false;
  if (policy?.requireRegistryMatch) {
    if (!patient?.nationalId && !patient?.countryId) {
      addSignal(signals, "PATIENT_ID_MISSING", "HIGH", "Patient ID is missing for registry verification.");
    }
    registryMatch = await checkRegistryMatch(patient, countryCode);
    if (!registryMatch) {
      addSignal(signals, "PATIENT_ID_NOT_IN_REGISTRY", "HIGH", "Patient identity does not match national registry.");
    }
  }

  const rules = await loadRules(countryCode);
  const patientDob = patient?.dob ? new Date(patient.dob) : null;
  const patientGender = normalize(patient?.gender || "");

  let serviceStart = claim.servicePeriod?.start ? new Date(claim.servicePeriod.start) : now;
  let serviceEnd = claim.servicePeriod?.end ? new Date(claim.servicePeriod.end) : serviceStart;
  if (Number.isNaN(serviceStart.getTime())) serviceStart = now;
  if (Number.isNaN(serviceEnd.getTime())) serviceEnd = serviceStart;

  if (serviceEnd < serviceStart) {
    addSignal(signals, "SERVICE_PERIOD_INVALID", "HIGH", "Service period end is before start.");
  }

  const maxFutureDays = Number(policy?.maxFutureServiceDays ?? 2);
  if (maxFutureDays >= 0) {
    const futureLimit = new Date(now.getTime() + maxFutureDays * 24 * 60 * 60 * 1000);
    if (serviceEnd > futureLimit) {
      addSignal(signals, "SERVICE_DATE_IN_FUTURE", "MEDIUM", "Service period ends too far in the future.");
    }
  }

  if (Number(claim.totalAmount || 0) <= 0) {
    addSignal(signals, "CLAIM_ZERO_AMOUNT", "MEDIUM", "Claim total amount is zero or negative.");
  }

  const procedures = Array.isArray(claim.procedures) ? claim.procedures : [];

  let duplicateOf = null;

  if (procedures.length === 0) {
    addSignal(signals, "NO_PROCEDURES", "HIGH", "Claim contains no procedures.");
  }

  for (const procedure of procedures) {
    for (const rule of rules) {
      if (!ruleMatches(rule, procedure)) continue;
      if (rule.ruleType === "GENDER_ONLY" && rule.allowedGenders?.length) {
        const allowed = rule.allowedGenders.map(normalize);
        if (!allowed.includes(patientGender)) {
          addSignal(signals, "GENDER_MISMATCH", rule.severity || "HIGH", "Procedure not allowed for patient gender.");
        }
      }
      if (rule.ruleType === "AGE_LIMIT" && patientDob) {
        const age = Math.floor((Date.now() - patientDob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        if (rule.minAge !== null && age < rule.minAge) {
          addSignal(signals, "AGE_TOO_LOW", rule.severity || "HIGH", "Patient below minimum age for procedure.");
        }
        if (rule.maxAge !== null && age > rule.maxAge) {
          addSignal(signals, "AGE_TOO_HIGH", rule.severity || "HIGH", "Patient above maximum age for procedure.");
        }
      }
      if (rule.ruleType === "MAX_PER_WINDOW" && rule.maxPerWindow && rule.windowDays) {
        const since = new Date(serviceStart.getTime() - rule.windowDays * 24 * 60 * 60 * 1000);
        const count = await Claim.countDocuments({
          patient: claim.patient,
          createdAt: { $gte: since },
          "procedures.code": procedure.code,
        });
        if (count >= rule.maxPerWindow) {
          addSignal(
            signals,
            "PROCEDURE_FREQUENCY",
            rule.severity || "HIGH",
            `Procedure exceeds ${rule.maxPerWindow} within ${rule.windowDays} days.`
          );
        }
      }
      if (rule.ruleType === "COOLDOWN_DAYS" && rule.cooldownDays) {
        const since = new Date(serviceStart.getTime() - rule.cooldownDays * 24 * 60 * 60 * 1000);
        const prior = await Claim.findOne({
          patient: claim.patient,
          createdAt: { $gte: since },
          "procedures.code": procedure.code,
        })
          .select("_id")
          .lean();
        if (prior) {
          addSignal(
            signals,
            "PROCEDURE_COOLDOWN",
            rule.severity || "MEDIUM",
            `Procedure performed within ${rule.cooldownDays} days cooldown.`
          );
        }
      }
    }

    const accreditations = Array.isArray(hospital?.accreditations) ? hospital.accreditations : [];
    const procedureAllowed = accreditations.some((acc) => {
      const codeMatch = normalize(acc.code) === normalize(procedure.code);
      const categoryMatch = acc.categories?.map(normalize).includes(normalize(procedure.category));
      const active = acc.status === "ACTIVE";
      return active && (codeMatch || categoryMatch);
    });

    if (accreditations.length === 0) {
      addSignal(
        signals,
        "HOSPITAL_ACCREDITATION_MISSING",
        "HIGH",
        "Hospital accreditation list is missing for capability verification."
      );
    } else if (!procedureAllowed) {
      addSignal(
        signals,
        "HOSPITAL_NOT_ACCREDITED",
        "HIGH",
        "Hospital accreditation does not cover this procedure."
      );
    }

    const dupWindowStart = new Date(serviceStart.getTime() - 2 * 24 * 60 * 60 * 1000);
    const dupWindowEnd = new Date(serviceEnd.getTime() + 2 * 24 * 60 * 60 * 1000);
    const duplicate = await Claim.findOne({
      _id: { $ne: claim._id },
      patient: claim.patient,
      "procedures.code": procedure.code,
      "servicePeriod.start": { $lte: dupWindowEnd },
      "servicePeriod.end": { $gte: dupWindowStart },
    })
      .select("_id hospital")
      .lean();
    if (duplicate) {
      duplicateOf = duplicate._id;
      addSignal(
        signals,
        "DUPLICATE_PROCEDURE",
        "HIGH",
        "Potential duplicate claim for the same procedure and time window."
      );
    }
  }

  const patientClaimYearLimit = policy?.maxClaimsPerPatientPerYear || 50;
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const yearlyCount = await Claim.countDocuments({ patient: claim.patient, createdAt: { $gte: yearStart } });
  if (yearlyCount > patientClaimYearLimit) {
    addSignal(
      signals,
      "PATIENT_HIGH_VOLUME",
      "MEDIUM",
      `Patient exceeds ${patientClaimYearLimit} claims in the current year.`
    );
  }

  const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const hospitalClaims30 = await Claim.countDocuments({ hospital: claim.hospital, createdAt: { $gte: last30Days } });
  const previous30 = await Claim.countDocuments({
    hospital: claim.hospital,
    createdAt: { $gte: new Date(last30Days.getTime() - 30 * 24 * 60 * 60 * 1000), $lt: last30Days },
  });
  if (previous30 > 0 && hospitalClaims30 > previous30 * 3) {
    addSignal(
      signals,
      "HOSPITAL_VOLUME_SPIKE",
      "MEDIUM",
      "Hospital claims volume spiked >3x versus prior 30 days."
    );
  }

  let riskScore = signals.reduce((sum, s) => sum + severityScore(s.severity), 0);
  if (signals.length === 0) riskScore = 0;

  let statusOverride = null;
  const hasHigh = signals.some((s) => s.severity === "HIGH");
  const rejectSignals = new Set();
  if (policy?.rejectOnRegistryMismatch) {
    rejectSignals.add("PATIENT_ID_NOT_IN_REGISTRY");
    rejectSignals.add("PATIENT_ID_MISSING");
  }
  if (policy?.rejectOnUnverifiedHospital) {
    rejectSignals.add("HOSPITAL_NOT_VERIFIED");
    rejectSignals.add("HOSPITAL_REGISTRY_INACTIVE");
  }
  if (policy?.rejectOnProviderMismatch) {
    rejectSignals.add("PROVIDER_NOT_ENABLED");
    rejectSignals.add("PROVIDER_MISSING");
  }
  if (policy?.rejectOnUnaccreditedProcedure) rejectSignals.add("HOSPITAL_NOT_ACCREDITED");

  const shouldReject = signals.some((s) => rejectSignals.has(s.code));
  if (shouldReject) {
    statusOverride = "REJECTED";
  } else if (hasHigh) {
    statusOverride = "REVIEW_REQUIRED";
  }

  return {
    riskScore,
    signals,
    statusOverride,
    registryMatch,
    duplicateOf,
    duplicateGroupSeed: procedures[0]
      ? procedureKey(claim.patient, procedures[0], serviceStart.toISOString())
      : "",
  };
}
