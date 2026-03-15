import Claim from "../models/Claim.js";
import Hospital from "../models/Hospital.js";
import Patient from "../models/Patient.js";
import FraudAlert from "../models/FraudAlert.js";
import ClaimAuditLog from "../models/ClaimAuditLog.js";
import { appendClaimAudit } from "../services/claimAuditService.js";
import { evaluateClaim } from "../services/claimFraudEngine.js";
import { decrypt } from "../services/cryptoService.js";
import { stableStringify, verifySignature } from "../utils/claimSignature.js";

function resolveHospitalId(req) {
  return req.user?.hospitalId || req.user?.hospital || req.body?.hospitalId || null;
}

export const submitClaim = async (req, res, next) => {
  try {
    const hospitalId = resolveHospitalId(req);
    if (!hospitalId) return res.status(400).json({ message: "Hospital is required" });

    const hospital = await Hospital.findById(hospitalId).lean();
    if (!hospital) return res.status(404).json({ message: "Hospital not found" });

    const patient = await Patient.findById(req.body?.patientId).lean();
    if (!patient) return res.status(404).json({ message: "Patient not found" });

    if (String(patient.hospital) !== String(hospitalId)) {
      return res.status(403).json({ message: "Patient is not linked to this hospital" });
    }

    const requireSignature =
      hospital?.claimsSecurity?.requireSignature !== false &&
      process.env.CLAIM_SIGNATURE_REQUIRED !== "0";

    if (requireSignature) {
      const keyId = req.header("x-claim-key-id") || "";
      if (!hospital?.claimsSecurity?.hmacSecretEnc) {
        return res.status(400).json({ message: "Hospital claim secret not configured" });
      }
      if (keyId && hospital.claimsSecurity?.keyId && keyId !== hospital.claimsSecurity.keyId) {
        return res.status(403).json({ message: "Invalid claim key id" });
      }
      const masterKey = process.env.CLAIM_SECRET_KEY;
      if (!masterKey) {
        return res.status(500).json({ message: "CLAIM_SECRET_KEY not configured" });
      }
      const payload = stableStringify(req.body || {});
      const signature = req.header("x-claim-signature") || "";
      const secret = decrypt(hospital.claimsSecurity.hmacSecretEnc, masterKey);
      const valid = verifySignature({ secret, payload, signature });
      if (!valid) {
        return res.status(403).json({ message: "Invalid claim signature" });
      }
    }

    const now = new Date();
    const safeDate = (value, fallback) => {
      if (!value) return fallback;
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? fallback : parsed;
    };
    const servicePeriod = req.body?.servicePeriod || {};
    const normalizedServicePeriod = {
      start: safeDate(servicePeriod?.start, now),
      end: safeDate(servicePeriod?.end, safeDate(servicePeriod?.start, now)),
    };

    const claim = new Claim({
      hospital: hospitalId,
      patient: patient._id,
      encounter: req.body?.encounterId || null,
      provider: req.body?.provider || {},
      country: req.body?.country || hospital?.location?.country || "",
      currency: req.body?.currency || "KES",
      totalAmount: Number(req.body?.totalAmount || 0),
      servicePeriod: normalizedServicePeriod,
      procedures: Array.isArray(req.body?.procedures) ? req.body.procedures : [],
      submissionChannel: "API",
      submittedBy: req.user?._id || null,
      signature: {
        algorithm: "HMAC-SHA256",
        value: req.header("x-claim-signature") || "",
        keyId: req.header("x-claim-key-id") || hospital?.claimsSecurity?.keyId || "",
        signedAt: new Date(),
      },
      patientSnapshot: {
        nationalId: patient.nationalId || "",
        countryId: patient.countryId || "",
        dob: patient.dob || null,
        gender: patient.gender || "",
        registryMatch: null,
        identityStatus: patient?.identityVerification?.status || "",
      },
      hospitalSnapshot: {
        name: hospital.name || "",
        registrationNumber: hospital?.verification?.registrationNumber || "",
        verificationStatus: hospital?.verification?.status || "",
      },
    });

    const evaluation = await evaluateClaim({ claim, hospital, patient });
    claim.riskScore = evaluation.riskScore;
    claim.riskSignals = evaluation.signals;
    claim.riskFlags = [...new Set(evaluation.signals.map((s) => s.code))];
    claim.duplicateGroup = evaluation.duplicateGroupSeed || "";
    if (evaluation.duplicateOf) {
      claim.duplicateOf = evaluation.duplicateOf;
    }
    if (evaluation.statusOverride) {
      claim.status = evaluation.statusOverride;
    }
    if (evaluation.registryMatch !== undefined) {
      claim.patientSnapshot.registryMatch = evaluation.registryMatch;
      const method = patient?.nationalId ? "NATIONAL_ID" : patient?.countryId ? "HEALTH_ID" : "";
      await Patient.updateOne(
        { _id: patient._id },
        {
          $set: {
            "identityVerification.registryMatch": evaluation.registryMatch,
            "identityVerification.lastCheckedAt": now,
            "identityVerification.method": method,
          },
        }
      );
      if (evaluation.registryMatch) {
        await Patient.updateOne(
          { _id: patient._id },
          {
            $set: {
              "identityVerification.status": "VERIFIED",
              "identityVerification.verifiedAt": now,
              "identityVerification.immutable": true,
            },
          }
        );
        claim.patientSnapshot.identityStatus = "VERIFIED";
      } else {
        await Patient.updateOne(
          { _id: patient._id, "identityVerification.status": { $ne: "VERIFIED" } },
          { $set: { "identityVerification.status": "UNVERIFIED" } }
        );
        claim.patientSnapshot.identityStatus = patient?.identityVerification?.status || "UNVERIFIED";
      }
    }

    await claim.save();

    if (evaluation.signals.length > 0) {
      const severity = evaluation.signals.some((s) => s.severity === "HIGH")
        ? "HIGH"
        : evaluation.signals.some((s) => s.severity === "MEDIUM")
          ? "MEDIUM"
          : "LOW";
      await FraudAlert.create({
        claim: claim._id,
        hospital: hospitalId,
        patient: patient._id,
        severity,
        signals: evaluation.signals.map((s) => s.code),
      });
    }

    await appendClaimAudit({
      claimId: claim._id,
      event: "CLAIM_SUBMITTED",
      payload: {
        status: claim.status,
        riskScore: claim.riskScore,
        riskFlags: claim.riskFlags,
      },
      actorId: req.user?._id,
    });

    return res.status(201).json({ claim, risk: evaluation });
  } catch (err) {
    next(err);
  }
};

export const listClaims = async (req, res, next) => {
  try {
    const role = String(req.user?.role || "").toUpperCase();
    const hospitalId = req.user?.hospitalId || req.user?.hospital;
    const filter = {};
    if (!["SUPER_ADMIN", "SYSTEM_ADMIN"].includes(role)) {
      filter.hospital = hospitalId;
    } else if (req.query.hospitalId) {
      filter.hospital = req.query.hospitalId;
    }
    if (req.query.status) filter.status = String(req.query.status).toUpperCase();
    if (req.query.provider) filter["provider.code"] = String(req.query.provider).toUpperCase();
    if (req.query.patientId) filter.patient = req.query.patientId;

    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const items = await Claim.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("hospital", "name code")
      .populate("patient", "firstName lastName gender nationalId");
    return res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const getClaim = async (req, res, next) => {
  try {
    const claim = await Claim.findById(req.params.id)
      .populate("hospital", "name code")
      .populate("patient", "firstName lastName gender nationalId")
      .populate("submittedBy", "name email role");
    if (!claim) return res.status(404).json({ message: "Claim not found" });

    const role = String(req.user?.role || "").toUpperCase();
    const hospitalId = req.user?.hospitalId || req.user?.hospital;
    if (!["SUPER_ADMIN", "SYSTEM_ADMIN"].includes(role) && String(claim.hospital?._id) !== String(hospitalId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return res.json({ claim });
  } catch (err) {
    next(err);
  }
};

export const listClaimAuditLogs = async (req, res, next) => {
  try {
    const claim = await Claim.findById(req.params.id)
      .select("_id hospital")
      .lean();
    if (!claim) return res.status(404).json({ message: "Claim not found" });

    const role = String(req.user?.role || "").toUpperCase();
    const hospitalId = req.user?.hospitalId || req.user?.hospital;
    if (!["SUPER_ADMIN", "SYSTEM_ADMIN"].includes(role) && String(claim.hospital) !== String(hospitalId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const items = await ClaimAuditLog.find({ claim: claim._id })
      .sort({ sequence: 1 })
      .limit(500)
      .lean();
    return res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const reviewClaim = async (req, res, next) => {
  try {
    const claim = await Claim.findById(req.params.id);
    if (!claim) return res.status(404).json({ message: "Claim not found" });
    const decision = String(req.body?.decision || "").toUpperCase();
    if (!["APPROVE", "REJECT"].includes(decision)) {
      return res.status(400).json({ message: "Invalid decision" });
    }
    claim.status = decision === "APPROVE" ? "APPROVED" : "REJECTED";
    claim.decision = {
      reviewedBy: req.user?._id || null,
      reviewedAt: new Date(),
      notes: String(req.body?.notes || "").trim(),
    };
    await claim.save();

    await appendClaimAudit({
      claimId: claim._id,
      event: "CLAIM_REVIEWED",
      payload: { status: claim.status, notes: claim.decision.notes || "" },
      actorId: req.user?._id,
    });

    return res.json({ claim });
  } catch (err) {
    next(err);
  }
};

export const listFraudAlerts = async (req, res, next) => {
  try {
    const role = String(req.user?.role || "").toUpperCase();
    const hospitalId = req.user?.hospitalId || req.user?.hospital;
    const filter = {};
    if (!["SUPER_ADMIN", "SYSTEM_ADMIN"].includes(role)) {
      filter.hospital = hospitalId;
    } else if (req.query.hospitalId) {
      filter.hospital = req.query.hospitalId;
    }
    if (req.query.status) filter.status = String(req.query.status).toUpperCase();
    if (req.query.severity) filter.severity = String(req.query.severity).toUpperCase();

    const alerts = await FraudAlert.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .populate("claim", "status riskScore provider totalAmount createdAt")
      .populate("hospital", "name code")
      .populate("patient", "firstName lastName nationalId");
    return res.json({ items: alerts });
  } catch (err) {
    next(err);
  }
};

export const getFraudSummary = async (req, res, next) => {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const totalClaims = await Claim.countDocuments({ createdAt: { $gte: since } });
    const reviewClaims = await Claim.countDocuments({ createdAt: { $gte: since }, status: "REVIEW_REQUIRED" });
    const rejectedClaims = await Claim.countDocuments({ createdAt: { $gte: since }, status: "REJECTED" });
    const openAlerts = await FraudAlert.countDocuments({ status: "OPEN" });

    return res.json({
      totals: { totalClaims, reviewClaims, rejectedClaims, openAlerts },
    });
  } catch (err) {
    next(err);
  }
};
