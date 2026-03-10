import Transfer from "../models/Transfer.js";
import Patient from "../models/Patient.js";
import TransferConsent from "../models/TransferConsent.js";
import Encounter from "../models/Encounter.js";
import LabOrder from "../models/LabOrder.js";
import Prescription from "../models/Prescription.js";
import Report from "../models/Report.js";
import AuditLog from "../models/AuditLog.js";
import { getIO } from "../utils/socket.js";
import { normalizeRole } from "../utils/normalizeRole.js";
import { encodeCursor, decodeCursor } from "../utils/cursor.js";
import { appendComplianceLedger } from "../utils/complianceLedger.js";
import { signProvenance, verifyProvenance } from "../utils/provenance.js";

function canAccessTransfer(user, transfer) {
  const role = normalizeRole(user?.role || "");
  if (["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role)) return true;
  const hospital = String(user?.hospital || user?.hospitalId || "");
  return (
    hospital &&
    (hospital === String(transfer.fromHospital) || hospital === String(transfer.toHospital))
  );
}

function resolveHospital(req) {
  return req.user?.hospital || req.user?.hospitalId || null;
}

function isPrivilegedTransferRole(user) {
  const role = normalizeRole(user?.role || "");
  return ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role);
}

function isActiveConsent(consent) {
  if (!consent || consent.status !== "GRANTED") return false;
  if (consent.expiresAt && new Date(consent.expiresAt) < new Date()) return false;
  return true;
}

async function requireConsentForCrossHospitalRead(req, transfer) {
  if (!transfer) {
    return { ok: false, status: 404, message: "Transfer not found" };
  }
  if (!canAccessTransfer(req.user, transfer)) {
    return { ok: false, status: 403, message: "Cross-hospital access denied" };
  }
  if (isPrivilegedTransferRole(req.user)) {
    return { ok: true, consent: null };
  }
  const userHospital = String(resolveHospital(req) || "");
  const sourceHospital = String(transfer.fromHospital || "");
  if (userHospital && userHospital === sourceHospital) {
    return { ok: true, consent: null };
  }
  const consent = await TransferConsent.findOne({ transfer: transfer._id });
  if (!isActiveConsent(consent)) {
    return { ok: false, status: 403, message: "Active patient consent required" };
  }
  return { ok: true, consent };
}

function toFHIRBundle(patient, transfer, consent) {
  const scopes = new Set(consent?.scopes || []);
  const allowDemographics = scopes.has("demographics");
  const allowEncounters = scopes.has("encounters");
  const allowContent = allowDemographics || allowEncounters;
  return {
    resourceType: "Bundle",
    type: "collection",
    entry: [
      ...(allowDemographics
        ? [
            {
              resource: {
                resourceType: "Patient",
                id: String(patient._id),
                name: [{ text: `${patient.firstName || ""} ${patient.lastName || ""}`.trim() }],
                birthDate: patient.dob ? new Date(patient.dob).toISOString().slice(0, 10) : null,
                identifier: [{ system: "AfyaLink", value: patient.nationalId || patient.countryId }],
                gender: patient.gender || undefined,
              },
            },
          ]
        : []),
      ...(allowEncounters
        ? [
            {
              resource: {
                resourceType: "Task",
                id: String(transfer._id),
                status: transfer.status.toLowerCase(),
                intent: "order",
                description: transfer.reasons || "Inter-hospital transfer",
                authoredOn: transfer.createdAt,
              },
            },
          ]
        : []),
      ...(allowContent
        ? [
            {
              resource: {
                resourceType: "Consent",
                id: String(consent._id),
                status: consent.status.toLowerCase(),
                scope: { text: "Patient data sharing for transfer" },
                dateTime: consent.updatedAt,
              },
            },
          ]
        : []),
    ].filter(Boolean),
  };
}

function toHL7ADT(patient, transfer, consent) {
  const scopes = new Set(consent?.scopes || []);
  const allowDemographics = scopes.has("demographics");
  const allowEncounters = scopes.has("encounters");
  if (!allowDemographics && !allowEncounters) {
    return null;
  }
  const ts = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const pid = patient.nationalId || patient.countryId || String(patient._id);
  const name = `${patient.lastName || ""}^${patient.firstName || ""}`;
  return [
    `MSH|^~\\&|AFYALINK|${transfer.fromHospital}|AFYALINK|${transfer.toHospital}|${ts}||ADT^A08|${transfer._id}|P|2.5`,
    ...(allowDemographics
      ? [
          `PID|||${pid}||${name}||${patient.dob ? new Date(patient.dob).toISOString().slice(0, 10) : ""}|${patient.gender || ""}`,
        ]
      : []),
    `PV1||I|||TRANSFER^AFYALINK`,
    ...(allowEncounters
      ? [`OBX|1|TX|REASON||${transfer.reasons || "Transfer request"}||||||F`]
      : []),
  ].join("\r");
}

async function buildTransferHandoverPackage(transfer, consent) {
  const patient = await Patient.findById(transfer.patient).lean();
  if (!patient) {
    return { ok: false, status: 404, message: "Patient not found", missing: ["patient"] };
  }

  const latestEncounter = await Encounter.findOne({
    patient: transfer.patient,
    hospital: transfer.fromHospital,
  })
    .sort({ updatedAt: -1 })
    .lean();

  const encounterId = latestEncounter?._id || null;

  const [latestLabs, latestPrescriptions, latestReports] = await Promise.all([
    encounterId
      ? LabOrder.find({ encounter: encounterId }).sort({ createdAt: -1 }).limit(10).lean()
      : [],
    encounterId
      ? Prescription.find({ encounter: encounterId }).sort({ createdAt: -1 }).limit(10).lean()
      : [],
    Report.find({ patient: transfer.patient, hospital: transfer.fromHospital })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
  ]);

  const handoverSummary =
    transfer?.metadata?.handoverSummary ||
    latestEncounter?.consultationNotes ||
    latestEncounter?.diagnosis ||
    "";

  const missing = [];
  if (!patient.firstName || !patient.lastName) missing.push("patient_name");
  if (!patient.dob) missing.push("patient_dob");
  if (!patient.gender) missing.push("patient_gender");
  if (!latestEncounter) missing.push("latest_encounter");
  if (!handoverSummary || !String(handoverSummary).trim()) missing.push("handover_summary");
  if (!latestEncounter?.diagnosis || !String(latestEncounter.diagnosis).trim()) {
    missing.push("latest_diagnosis");
  }
  if (latestLabs.length === 0 && latestPrescriptions.length === 0 && latestReports.length === 0) {
    missing.push("clinical_artifacts");
  }

  const totalChecks = 7;
  const completionScore = Math.max(0, Math.round(((totalChecks - missing.length) / totalChecks) * 100));

  return {
    ok: true,
    completionScore,
    missing,
    package: {
      transferId: String(transfer._id),
      patient: {
        id: String(patient._id),
        firstName: patient.firstName || "",
        lastName: patient.lastName || "",
        dob: patient.dob || null,
        gender: patient.gender || "",
        nationalId: patient.nationalId || "",
        countryId: patient.countryId || "",
        contact: patient.contact || "",
        address: patient.address || "",
        insurance: patient.insurance || {},
      },
      encounter: latestEncounter
        ? {
            id: String(latestEncounter._id),
            state: latestEncounter.state,
            diagnosis: latestEncounter.diagnosis || "",
            consultationNotes: latestEncounter.consultationNotes || "",
            updatedAt: latestEncounter.updatedAt,
          }
        : null,
      labs: latestLabs.map((it) => ({
        id: String(it._id),
        testName: it.testName,
        status: it.status,
        result: it.result || "",
        completedAt: it.completedAt || null,
      })),
      prescriptions: latestPrescriptions.map((it) => ({
        id: String(it._id),
        status: it.status,
        medications: it.medications || [],
        dispensedAt: it.dispensedAt || null,
      })),
      reports: latestReports.map((it) => ({
        id: String(it._id),
        title: it.title || "",
        createdAt: it.createdAt,
      })),
      consent: consent
        ? {
            id: String(consent._id),
            status: consent.status,
            scopes: consent.scopes || [],
            expiresAt: consent.expiresAt || null,
          }
        : null,
      handoverSummary: String(handoverSummary || ""),
      generatedAt: new Date().toISOString(),
      completionScore,
      missing,
    },
  };
}

export const listTransfers = async (req, res, next) => {
  try {
    const hospital = resolveHospital(req);
    const role = normalizeRole(req.user?.role || "");

    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "25", 10), 1), 100);
    const cursor = req.query.cursor || null;
    const status = req.query.status;

    const filter = {};
    if (status) filter.status = status;
    if (!["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role)) {
      filter.$or = [{ fromHospital: hospital }, { toHospital: hospital }];
    }

    if (cursor) {
      const parsed = decodeCursor(cursor);
      if (!parsed?.createdAt || !parsed?._id) {
        return res.status(400).json({ message: "Invalid cursor" });
      }
      filter.$and = [
        ...(filter.$and || []),
        {
          $or: [
            { createdAt: { $lt: new Date(parsed.createdAt) } },
            { createdAt: new Date(parsed.createdAt), _id: { $lt: parsed._id } },
          ],
        },
      ];
      const rows = await Transfer.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit + 1)
        .populate("fromHospital toHospital requestedBy approvedBy")
        .lean();
      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;

      const transferIds = items.map((it) => it._id);
      const consents = await TransferConsent.find({ transfer: { $in: transferIds } })
        .select("transfer status expiresAt updatedAt")
        .lean();
      const consentByTransfer = new Map(
        consents.map((c) => [String(c.transfer), { status: c.status, expiresAt: c.expiresAt, updatedAt: c.updatedAt }])
      );
      const safeItems = items.map((item) => ({
        ...item,
        consent: consentByTransfer.get(String(item._id)) || { status: "PENDING" },
      }));
      const last = safeItems[safeItems.length - 1];
      const nextCursor = hasMore && last
        ? encodeCursor({
            createdAt: last.createdAt,
            _id: last._id,
          })
        : null;
      return res.json({ items: safeItems, nextCursor, hasMore, limit });
    }

    const [items, total] = await Promise.all([
      Transfer.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("fromHospital toHospital requestedBy approvedBy")
        .lean(),
      Transfer.countDocuments(filter),
    ]);

    const transferIds = items.map((it) => it._id);
    const consents = await TransferConsent.find({ transfer: { $in: transferIds } })
      .select("transfer status expiresAt updatedAt")
      .lean();
    const consentByTransfer = new Map(
      consents.map((c) => [String(c.transfer), { status: c.status, expiresAt: c.expiresAt, updatedAt: c.updatedAt }])
    );

    const safeItems = items.map((item) => ({
      ...item,
      consent: consentByTransfer.get(String(item._id)) || { status: "PENDING" },
    }));

    res.json({ items: safeItems, total, page, limit });
  } catch (err) {
    next(err);
  }
};

export const transferCommandCenterOverview = async (req, res, next) => {
  try {
    const hospital = resolveHospital(req);
    const role = normalizeRole(req.user?.role || "");
    const limit = Math.min(Math.max(parseInt(req.query.limit || "40", 10), 1), 100);
    const status = String(req.query.status || "").trim();

    const filter = {};
    if (!["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role)) {
      filter.$or = [{ fromHospital: hospital }, { toHospital: hospital }];
    }
    if (status) filter.status = status;

    const transfers = await Transfer.find(filter)
      .populate("patient", "firstName lastName nationalId countryId")
      .populate("fromHospital", "name code")
      .populate("toHospital", "name code")
      .populate("requestedBy", "name role")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const transferIds = transfers.map((row) => row._id);
    const consents = await TransferConsent.find({ transfer: { $in: transferIds } })
      .select("transfer status scopes expiresAt updatedAt")
      .lean();
    const consentMap = new Map(consents.map((row) => [String(row.transfer), row]));

    const items = transfers.map((row) => {
      const consent = consentMap.get(String(row._id)) || null;
      const completionScore = Number(row?.metadata?.handoverCompletionScore ?? 0);
      const missing = Array.isArray(row?.metadata?.handoverMissing) ? row.metadata.handoverMissing : [];
      const ageHours = Math.round((Date.now() - new Date(row.createdAt).getTime()) / (60 * 60 * 1000));
      const overdue =
        (row.status === "Pending" && ageHours >= 24) ||
        (row.status === "Approved" && ageHours >= 24);

      return {
        _id: row._id,
        status: row.status,
        reasons: row.reasons || "",
        patientName:
          `${row?.patient?.firstName || ""} ${row?.patient?.lastName || ""}`.trim() || "Unknown patient",
        patientIdentifier: row?.patient?.nationalId || row?.patient?.countryId || "",
        fromHospitalName: row?.fromHospital?.name || row?.fromHospital?.code || "—",
        toHospitalName: row?.toHospital?.name || row?.toHospital?.code || "—",
        requestedByName: row?.requestedBy?.name || "—",
        requestedByRole: row?.requestedBy?.role || "—",
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        ageHours,
        overdue,
        consentStatus: consent?.status || "PENDING",
        consentScopes: consent?.scopes || [],
        consentExpiresAt: consent?.expiresAt || null,
        handoverCompletionScore: completionScore,
        handoverMissingCount: missing.length,
        handoverMissing: missing,
        completedWithOverride: Boolean(row?.metadata?.completedWithOverride),
      };
    });

    const summary = {
      total: items.length,
      pending: items.filter((row) => row.status === "Pending").length,
      approved: items.filter((row) => row.status === "Approved").length,
      completed: items.filter((row) => row.status === "Completed").length,
      rejected: items.filter((row) => row.status === "Rejected").length,
      consentPending: items.filter((row) => row.consentStatus === "PENDING").length,
      overdue: items.filter((row) => row.overdue).length,
      lowContinuity: items.filter(
        (row) =>
          row.status !== "Rejected" &&
          row.status !== "Completed" &&
          row.handoverCompletionScore > 0 &&
          row.handoverCompletionScore < 100
      ).length,
      overrideCompletions: items.filter((row) => row.completedWithOverride).length,
    };

    return res.json({ summary, items });
  } catch (err) {
    next(err);
  }
};

export const requestTransfer = async (req, res, next) => {
  try {
    const hospital = resolveHospital(req);
    if (!hospital) return res.status(400).json({ message: "Hospital context required" });

    const role = normalizeRole(req.user?.role || "");
    const requestedFromHospital =
      ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role) && req.body?.fromHospital
        ? req.body.fromHospital
        : hospital;
    const targetHospital = req.body?.toHospital;
    const patientId = req.body?.patient;
    if (!targetHospital || !patientId) {
      return res.status(400).json({ message: "patient and toHospital are required" });
    }

    const patient = await Patient.findById(patientId).lean();
    if (!patient) return res.status(404).json({ message: "Patient not found" });
    if (String(patient.hospital) !== String(requestedFromHospital)) {
      return res.status(403).json({ message: "Patient is not under source hospital scope" });
    }
    if (String(requestedFromHospital) === String(targetHospital)) {
      return res.status(400).json({ message: "Source and destination hospital cannot be the same" });
    }

    const payload = {
      ...req.body,
      fromHospital: requestedFromHospital,
      toHospital: targetHospital,
      patient: patientId,
      requestedBy: req.user._id,
      status: "Pending",
    };
    const t = await Transfer.create(payload);
    t.audit = [
      {
        by: req.user._id,
        action: "requested",
        at: new Date(),
        note: req.body.reasons || "",
      },
    ];
    await t.save();

    await TransferConsent.create({
      transfer: t._id,
      patient: t.patient,
      fromHospital: t.fromHospital,
      toHospital: t.toHospital,
      status: "PENDING",
      scopes: req.body.scopes || ["demographics", "encounters", "labs", "prescriptions"],
    });

    await AuditLog.create({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: "TRANSFER_REQUESTED",
      resource: "Transfer",
      resourceId: t._id,
      hospital: t.fromHospital,
      metadata: { toHospital: t.toHospital, patient: t.patient },
      success: true,
    });
    await appendComplianceLedger({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: "TRANSFER_REQUESTED",
      resource: "Transfer",
      resourceId: t._id,
      hospital: t.fromHospital,
      metadata: { toHospital: t.toHospital, patient: t.patient },
    });

    try {
      getIO().to(String(t.toHospital)).emit("transferRequested", t);
    } catch (_e) {}
    res.json(t);
  } catch (err) {
    next(err);
  }
};

export const approveTransfer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const t = await Transfer.findById(id);
    if (!t) return res.status(404).json({ message: "Not found" });
    if (!canAccessTransfer(req.user, t)) {
      return res.status(403).json({ message: "Cross-hospital access denied" });
    }

    t.status = "Approved";
    t.approvedBy = req.user._id;
    t.audit.push({ by: req.user._id, action: "approved", at: new Date() });
    await t.save();

    const patient = await Patient.findById(t.patient);
    if (patient) {
      patient.metadata = patient.metadata || {};
      patient.metadata.transferHistory = patient.metadata.transferHistory || [];
      patient.metadata.transferHistory.push({
        from: t.fromHospital,
        to: t.toHospital,
        at: new Date(),
        by: req.user._id,
      });
      await patient.save();
    }

    await AuditLog.create({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: "TRANSFER_APPROVED",
      resource: "Transfer",
      resourceId: t._id,
      hospital: t.toHospital,
      metadata: { fromHospital: t.fromHospital, patient: t.patient },
      success: true,
    });
    await appendComplianceLedger({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: "TRANSFER_APPROVED",
      resource: "Transfer",
      resourceId: t._id,
      hospital: t.toHospital,
      metadata: { fromHospital: t.fromHospital, patient: t.patient },
    });

    try {
      getIO().to(String(t.requestedBy)).emit("transferApproved", t);
    } catch (_e) {}
    res.json(t);
  } catch (err) {
    next(err);
  }
};

export const rejectTransfer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const t = await Transfer.findById(id);
    if (!t) return res.status(404).json({ message: "Not found" });
    if (!canAccessTransfer(req.user, t)) {
      return res.status(403).json({ message: "Cross-hospital access denied" });
    }

    t.status = "Rejected";
    t.audit.push({ by: req.user._id, action: "rejected", at: new Date(), note: reason || "" });
    await t.save();

    await AuditLog.create({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: "TRANSFER_REJECTED",
      resource: "Transfer",
      resourceId: t._id,
      hospital: t.toHospital,
      metadata: { reason: reason || "" },
      success: true,
    });
    await appendComplianceLedger({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: "TRANSFER_REJECTED",
      resource: "Transfer",
      resourceId: t._id,
      hospital: t.toHospital,
      metadata: { reason: reason || "" },
    });

    try {
      getIO().to(String(t.requestedBy)).emit("transferRejected", t);
    } catch (_e) {}
    res.json(t);
  } catch (err) {
    next(err);
  }
};

export const completeTransfer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const t = await Transfer.findById(id);
    if (!t) return res.status(404).json({ message: "Not found" });
    if (!canAccessTransfer(req.user, t)) {
      return res.status(403).json({ message: "Cross-hospital access denied" });
    }

    const consent = await TransferConsent.findOne({ transfer: t._id }).lean();
    const handover = await buildTransferHandoverPackage(t, consent);
    if (!handover.ok) {
      return res.status(handover.status || 400).json({ message: handover.message || "Handover package generation failed" });
    }

    const forceComplete = req.body?.forceComplete === true;
    if (handover.completionScore < 100 && !forceComplete) {
      return res.status(422).json({
        message: "Transfer cannot be completed. Handover package has missing clinical fields.",
        completionScore: handover.completionScore,
        missing: handover.missing,
        handover: handover.package,
      });
    }

    t.status = "Completed";
    t.metadata = {
      ...(t.metadata || {}),
      handoverPackage: handover.package,
      handoverCompletionScore: handover.completionScore,
      handoverMissing: handover.missing,
      completedWithOverride: forceComplete && handover.completionScore < 100,
    };
    t.audit.push({ by: req.user._id, action: "completed", at: new Date() });
    await t.save();

    await AuditLog.create({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: "TRANSFER_COMPLETED",
      resource: "Transfer",
      resourceId: t._id,
      hospital: t.toHospital,
      metadata: { fromHospital: t.fromHospital, patient: t.patient },
      success: true,
    });
    await appendComplianceLedger({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: "TRANSFER_COMPLETED",
      resource: "Transfer",
      resourceId: t._id,
      hospital: t.toHospital,
      metadata: { fromHospital: t.fromHospital, patient: t.patient },
    });

    try {
      getIO().to(String(t.toHospital)).emit("transferCompleted", t);
    } catch (_e) {}
    res.json({ ...t.toObject(), handover: handover.package });
  } catch (err) {
    next(err);
  }
};

export const transferHandoverPackage = async (req, res, next) => {
  try {
    const transfer = req.transfer || (await Transfer.findById(req.params.id).lean());
    if (!transfer) return res.status(404).json({ message: "Transfer not found" });

    const guard = req.transfer
      ? { ok: true, consent: req.transferConsent || null }
      : await requireConsentForCrossHospitalRead(req, transfer);
    if (!guard.ok) return res.status(guard.status).json({ message: guard.message });

    const consent =
      guard.consent || req.transferConsent || (await TransferConsent.findOne({ transfer: transfer._id }).lean());
    const handover = await buildTransferHandoverPackage(transfer, consent);
    if (!handover.ok) {
      return res.status(handover.status || 400).json({ message: handover.message || "Handover package generation failed" });
    }
    return res.json(handover.package);
  } catch (err) {
    next(err);
  }
};

export const getTransferConsent = async (req, res, next) => {
  try {
    const transfer = req.transfer || (await Transfer.findById(req.params.id));
    const guard = req.transfer
      ? { ok: true }
      : await requireConsentForCrossHospitalRead(req, transfer);
    if (!guard.ok) {
      return res.status(guard.status).json({ message: guard.message });
    }

    const consent = await TransferConsent.findOne({ transfer: transfer._id }).lean();
    return res.json(consent || null);
  } catch (err) {
    next(err);
  }
};

export const grantTransferConsent = async (req, res, next) => {
  try {
    const transfer = await Transfer.findById(req.params.id);
    if (!transfer) return res.status(404).json({ message: "Transfer not found" });
    if (!canAccessTransfer(req.user, transfer)) {
      return res.status(403).json({ message: "Cross-hospital access denied" });
    }

    const consent = await TransferConsent.findOneAndUpdate(
      { transfer: transfer._id },
      {
        status: "GRANTED",
        grantedBy: req.user._id,
        scopes: req.body.scopes || undefined,
        expiresAt: req.body.expiresAt || undefined,
      },
      { new: true, upsert: true }
    );

    await AuditLog.create({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: "TRANSFER_CONSENT_GRANTED",
      resource: "TransferConsent",
      resourceId: consent._id,
      hospital: transfer.fromHospital,
      metadata: { transfer: transfer._id, scopes: consent.scopes, expiresAt: consent.expiresAt },
      success: true,
    });
    await appendComplianceLedger({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: "TRANSFER_CONSENT_GRANTED",
      resource: "TransferConsent",
      resourceId: consent._id,
      hospital: transfer.fromHospital,
      metadata: { transfer: transfer._id, scopes: consent.scopes, expiresAt: consent.expiresAt },
    });

    return res.json(consent);
  } catch (err) {
    next(err);
  }
};

export const revokeTransferConsent = async (req, res, next) => {
  try {
    const transfer = await Transfer.findById(req.params.id);
    if (!transfer) return res.status(404).json({ message: "Transfer not found" });
    if (!canAccessTransfer(req.user, transfer)) {
      return res.status(403).json({ message: "Cross-hospital access denied" });
    }

    const consent = await TransferConsent.findOneAndUpdate(
      { transfer: transfer._id },
      { status: "REVOKED", revokedBy: req.user._id },
      { new: true }
    );

    if (!consent) return res.status(404).json({ message: "Transfer consent not found" });

    await AuditLog.create({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: "TRANSFER_CONSENT_REVOKED",
      resource: "TransferConsent",
      resourceId: consent._id,
      hospital: transfer.fromHospital,
      metadata: { transfer: transfer._id },
      success: true,
    });
    await appendComplianceLedger({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: "TRANSFER_CONSENT_REVOKED",
      resource: "TransferConsent",
      resourceId: consent._id,
      hospital: transfer.fromHospital,
      metadata: { transfer: transfer._id },
    });

    return res.json(consent);
  } catch (err) {
    next(err);
  }
};

export const exportTransferFHIR = async (req, res, next) => {
  try {
    const transfer = req.transfer || (await Transfer.findById(req.params.id));
    const guard = req.transfer
      ? { ok: true, consent: req.transferConsent || null }
      : await requireConsentForCrossHospitalRead(req, transfer);
    if (!guard.ok) {
      return res.status(guard.status).json({ message: guard.message });
    }

    const consent = guard.consent || req.transferConsent || (await TransferConsent.findOne({ transfer: transfer._id }));
    if (!isActiveConsent(consent)) return res.status(403).json({ message: "Active patient consent required" });

    const patient = await Patient.findById(transfer.patient).lean();
    if (!patient) return res.status(404).json({ message: "Patient not found" });

    if (!Array.isArray(consent.scopes) || consent.scopes.length === 0) {
      return res.status(403).json({ message: "Consent scopes missing" });
    }
    const bundle = toFHIRBundle(patient, transfer, consent);
    if (!bundle.entry || bundle.entry.length === 0) {
      return res.status(403).json({ message: "No allowed FHIR fields for current consent scopes" });
    }
    const provenance = signProvenance(bundle, {
      format: "FHIR",
      transferId: String(transfer._id),
      consentId: String(consent._id),
      exportedBy: String(req.user?._id || ""),
    });
    bundle.meta = {
      ...(bundle.meta || {}),
      security: [{ system: "urn:afyalink:provenance", code: provenance.signature }],
      tag: [{ system: "urn:afyalink:provenance:algo", code: provenance.algorithm }],
    };

    await AuditLog.create({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: "TRANSFER_FHIR_EXPORTED",
      resource: "Transfer",
      resourceId: transfer._id,
      hospital: transfer.fromHospital,
      metadata: { consent: consent._id, toHospital: transfer.toHospital },
      success: true,
    });
    await appendComplianceLedger({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: "TRANSFER_FHIR_EXPORTED",
      resource: "Transfer",
      resourceId: transfer._id,
      hospital: transfer.fromHospital,
      metadata: { consent: consent._id, toHospital: transfer.toHospital },
    });

    res.setHeader("X-AfyaLink-Provenance", provenance.signature);
    res.setHeader("X-AfyaLink-Provenance-Alg", provenance.algorithm);
    res.setHeader("X-AfyaLink-Provenance-At", provenance.signedAt);

    return res.json(bundle);
  } catch (err) {
    next(err);
  }
};

export const exportTransferHL7 = async (req, res, next) => {
  try {
    const transfer = req.transfer || (await Transfer.findById(req.params.id));
    const guard = req.transfer
      ? { ok: true, consent: req.transferConsent || null }
      : await requireConsentForCrossHospitalRead(req, transfer);
    if (!guard.ok) {
      return res.status(guard.status).json({ message: guard.message });
    }

    const consent = guard.consent || req.transferConsent || (await TransferConsent.findOne({ transfer: transfer._id }));
    if (!isActiveConsent(consent)) return res.status(403).json({ message: "Active patient consent required" });

    const patient = await Patient.findById(transfer.patient).lean();
    if (!patient) return res.status(404).json({ message: "Patient not found" });

    if (!Array.isArray(consent.scopes) || consent.scopes.length === 0) {
      return res.status(403).json({ message: "Consent scopes missing" });
    }
    const hl7 = toHL7ADT(patient, transfer, consent);
    if (!hl7) {
      return res.status(403).json({ message: "No allowed HL7 fields for current consent scopes" });
    }
    const provenance = signProvenance(
      { hl7, transferId: String(transfer._id), consentId: String(consent._id) },
      {
        format: "HL7",
        transferId: String(transfer._id),
        consentId: String(consent._id),
        exportedBy: String(req.user?._id || ""),
      }
    );

    await AuditLog.create({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: "TRANSFER_HL7_EXPORTED",
      resource: "Transfer",
      resourceId: transfer._id,
      hospital: transfer.fromHospital,
      metadata: { consent: consent._id, toHospital: transfer.toHospital },
      success: true,
    });
    await appendComplianceLedger({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: "TRANSFER_HL7_EXPORTED",
      resource: "Transfer",
      resourceId: transfer._id,
      hospital: transfer.fromHospital,
      metadata: { consent: consent._id, toHospital: transfer.toHospital },
    });

    res.type("text/plain");
    res.setHeader("X-AfyaLink-Provenance", provenance.signature);
    res.setHeader("X-AfyaLink-Provenance-Alg", provenance.algorithm);
    res.setHeader("X-AfyaLink-Provenance-At", provenance.signedAt);
    return res.send(hl7);
  } catch (err) {
    next(err);
  }
};

export const transferAuditTrail = async (req, res, next) => {
  try {
    const transfer = req.transfer
      ? req.transfer.toObject?.() || req.transfer
      : await Transfer.findById(req.params.id).lean();
    const guard = req.transfer
      ? { ok: true }
      : await requireConsentForCrossHospitalRead(req, transfer);
    if (!guard.ok) {
      return res.status(guard.status).json({ message: guard.message });
    }

    const logs = await AuditLog.find({
      resource: { $in: ["Transfer", "TransferConsent"] },
      $or: [{ resourceId: transfer._id }, { "metadata.transfer": transfer._id }],
    })
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    return res.json({ transferId: transfer._id, logs });
  } catch (err) {
    next(err);
  }
};

export const verifyTransferProvenance = async (req, res, next) => {
  try {
    const transfer = req.transfer || (await Transfer.findById(req.params.id));
    const guard = req.transfer
      ? { ok: true, consent: req.transferConsent || null }
      : await requireConsentForCrossHospitalRead(req, transfer);
    if (!guard.ok) {
      return res.status(guard.status).json({ message: guard.message });
    }

    const { payload, signature } = req.body || {};
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ message: "payload object is required" });
    }
    if (!signature) {
      return res.status(400).json({ message: "signature is required" });
    }

    const result = verifyProvenance(payload, signature);

    await AuditLog.create({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: "TRANSFER_PROVENANCE_VERIFIED",
      resource: "Transfer",
      resourceId: transfer._id,
      hospital: transfer.fromHospital,
      metadata: { valid: result.valid, reason: result.reason },
      success: result.valid,
      error: result.valid ? null : result.reason,
    });
    await appendComplianceLedger({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: "TRANSFER_PROVENANCE_VERIFIED",
      resource: "Transfer",
      resourceId: transfer._id,
      hospital: transfer.fromHospital,
      metadata: { valid: result.valid, reason: result.reason },
    });

    return res.json(result);
  } catch (err) {
    next(err);
  }
};
