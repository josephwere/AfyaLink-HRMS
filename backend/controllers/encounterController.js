import workflowService from "../services/workflowService.js";
import { WORKFLOW } from "../constants/workflowStates.js";
import { createEncounterRuntime } from "../encounter/runtime/encounterRuntime.js";
import { ENCOUNTER_STATES } from "../encounter/runtime/encounterStateMachine.js";
import { createTelemedicineAdapter } from "../encounter/adapters/telemedicineAdapter.js";
import Invoice from "../models/Invoice.js";
import InsuranceAuthorization from "../models/InsuranceAuthorization.js";
import Encounter from "../models/Encounter.js";
import Patient from "../models/Patient.js";
import User from "../models/User.js";
import Diagnosis from "../models/Diagnosis.js";
import LabOrder from "../models/LabOrder.js";
import AuditLog from "../models/AuditLog.js";
import Financial from "../models/Financial.js";
import Prescription from "../models/Prescription.js";
import Hospital from "../models/Hospital.js";
import { notify, notifyRolesInHospital } from "../services/notificationService.js";
import { getSystemSettingsDoc } from "../utils/systemSettingsStore.js";
import { v4 as uuidv4 } from "uuid";
import { resolvePatientIdsForUser } from "../services/familyMonitoringService.js";
import { serializeEncounter } from "../utils/serializers.js";

function resolveHospitalId(req) {
  const role = String(req.user?.role || "").toUpperCase();
  const privileged = role === "SUPER_ADMIN" || role === "SYSTEM_ADMIN" || role === "DEVELOPER";
  if (privileged) {
    return req.query?.hospitalId || req.user?.hospital || req.user?.hospitalId || null;
  }
  return req.user?.hospital || req.user?.hospitalId || null;
}

function mapRuntimeStateToWorkflowState(state) {
  switch (state) {
    case ENCOUNTER_STATES.CREATED:
      return WORKFLOW.CREATED;
    case ENCOUNTER_STATES.CONSULTING:
      return WORKFLOW.CONSULTING;
    case ENCOUNTER_STATES.CLOSED:
      return WORKFLOW.CLOSED;
    default:
      return state;
  }
}

function mapWorkflowStateToRuntimeState(state) {
  switch (state) {
    case WORKFLOW.CREATED:
      return ENCOUNTER_STATES.CREATED;
    case WORKFLOW.CONSULTING:
      return ENCOUNTER_STATES.CONSULTING;
    case WORKFLOW.CLOSED:
      return ENCOUNTER_STATES.CLOSED;
    default:
      return ENCOUNTER_STATES.CREATED;
  }
}

function buildRuntimePublisher() {
  return {
    publish() {},
  };
}

export const createRuntimeEncounter = async (req, res) => {
  try {
    const hospitalId = resolveHospitalId(req);
    const patientId = String(req.body?.patientId || req.body?.patient || "").trim();
    const doctorId = String(req.body?.doctorId || req.body?.doctor || req.user?._id || req.user?.id || "").trim();
    const appointmentId = String(req.body?.appointmentId || req.body?.appointment || "").trim();
    const mode = String(req.body?.mode || "in-person").toLowerCase();

    if (!hospitalId || !patientId || !doctorId) {
      return res.status(400).json({ message: "Hospital, patient, and doctor are required" });
    }

    const runtime = createEncounterRuntime({ publisher: buildRuntimePublisher() });
    const runtimeEncounter = runtime.createEncounter({ patientId, doctorId, mode });
    const adapterState = mode === "telemedicine" ? createTelemedicineAdapter().connect() : null;

    const encounterDoc = new Encounter({
      patient: patientId,
      doctor: doctorId,
      hospital: hospitalId,
      appointment: appointmentId || undefined,
      state: mapRuntimeStateToWorkflowState(runtimeEncounter.state),
    });
    encounterDoc.$locals = { ...(encounterDoc.$locals || {}), viaWorkflow: true };
    await encounterDoc.save();

    return res.status(201).json({
      encounter: encounterDoc.toObject(),
      runtime: { ...runtimeEncounter, adapter: adapterState },
    });
  } catch (err) {
    console.error("Create runtime encounter error:", err);
    return res.status(500).json({ message: err?.message || "Failed to create encounter" });
  }
};

export const joinRuntimeEncounter = async (req, res) => {
  try {
    const encounterDoc = await Encounter.findById(req.params.id).select("_id state").lean();
    if (!encounterDoc) {
      return res.status(404).json({ message: "Encounter not found" });
    }

    const runtime = createEncounterRuntime({ publisher: buildRuntimePublisher() });
    const participant = {
      id: String(req.user?._id || req.user?.id || req.body?.participantId || "anonymous"),
      role: String(req.user?.role || req.body?.role || "PATIENT"),
      connectionId: String(req.body?.connectionId || `conn-${Date.now()}`),
    };

    const participants = runtime.joinPresence(String(encounterDoc._id), participant);
    return res.json({
      encounterId: String(encounterDoc._id),
      presence: {
        encounterId: String(encounterDoc._id),
        participants,
      },
    });
  } catch (err) {
    console.error("Join runtime encounter error:", err);
    return res.status(500).json({ message: err?.message || "Failed to join encounter" });
  }
};

export const startRuntimeEncounter = async (req, res) => {
  try {
    const encounterDoc = await Encounter.findById(req.params.id);
    if (!encounterDoc) {
      return res.status(404).json({ message: "Encounter not found" });
    }

    const runtime = createEncounterRuntime({ publisher: buildRuntimePublisher() });
    const runtimeEncounter = {
      id: String(encounterDoc._id),
      state: mapWorkflowStateToRuntimeState(encounterDoc.state),
      timeline: [],
    };

    const transitioned = runtime.transitionEncounter(runtimeEncounter, {
      to: ENCOUNTER_STATES.CONSULTING,
      actor: req.user?._id || req.user?.id || "system",
      note: String(req.body?.note || "Encounter started"),
    });

    encounterDoc.state = mapRuntimeStateToWorkflowState(transitioned.state);
    encounterDoc.$locals = { ...(encounterDoc.$locals || {}), viaWorkflow: true };
    await encounterDoc.save();

    return res.json({
      encounter: encounterDoc.toObject(),
      runtime: transitioned,
    });
  } catch (err) {
    console.error("Start runtime encounter error:", err);
    return res.status(500).json({ message: err?.message || "Failed to start encounter" });
  }
};

function toAllowedTransitions(state) {
  switch (state) {
    case WORKFLOW.LAB_ORDERED:
      return ["LAB_COMPLETED"];
    case WORKFLOW.PRESCRIPTION_CREATED:
      return ["DISPENSED"];
    case WORKFLOW.BILLED:
      return ["PAID"];
    default:
      return [];
  }
}

function resolveCloseoutPolicy(systemSettings, hospitalFeatures = {}, hospitalCustomization = {}) {
  const defaults = systemSettings?.clinical?.closeoutPolicy || {};
  const overrides = hospitalCustomization?.clinical?.closeoutPolicy || {};
  const overrideEnabled = Boolean(overrides?.enabled);
  const pick = (key, fallback) =>
    overrideEnabled && overrides[key] !== null && overrides[key] !== undefined
      ? overrides[key]
      : fallback;
  return {
    requireDiagnosisBeforeClose: Boolean(
      pick("requireDiagnosisBeforeClose", defaults.requireDiagnosisBeforeClose !== false)
    ),
    requireBillingHandoffWhenPaymentsEnabled:
      Boolean(
        pick(
          "requireBillingHandoffWhenPaymentsEnabled",
          defaults.requireBillingHandoffWhenPaymentsEnabled !== false
        )
      ) && Boolean(hospitalFeatures?.payments),
    requirePrescriptionWhenPharmacyEnabled:
      Boolean(
        pick(
          "requirePrescriptionWhenPharmacyEnabled",
          defaults.requirePrescriptionWhenPharmacyEnabled === true
        )
      ) && Boolean(hospitalFeatures?.pharmacy),
    overrideEnabled,
  };
}

function buildEncounterCloseoutSummary(encounter, { policy, billing = null, prescriptionSummary = null } = {}) {
  const missingRequirements = [];
  if (
    policy.requireDiagnosisBeforeClose &&
    !String(encounter?.diagnosis || "").trim() &&
    !String(encounter?.consultationNotes || "").trim()
  ) {
    missingRequirements.push("DIAGNOSIS");
  }
  if (policy.requireBillingHandoffWhenPaymentsEnabled && !billing?.invoiceNumber) {
    missingRequirements.push("BILLING");
  }
  if (policy.requirePrescriptionWhenPharmacyEnabled && !(prescriptionSummary?.count > 0)) {
    missingRequirements.push("PRESCRIPTION");
  }

  return {
    canClose: missingRequirements.length === 0,
    missingRequirements,
    requirements: {
      diagnosis: policy.requireDiagnosisBeforeClose,
      billing: policy.requireBillingHandoffWhenPaymentsEnabled,
      prescription: policy.requirePrescriptionWhenPharmacyEnabled,
    },
  };
}

export const listEncounters = async (req, res) => {
  try {
    const hospitalId = resolveHospitalId(req);
    const role = String(req.user?.role || "").toUpperCase();
    if (!hospitalId && role !== "PATIENT") {
      return res.json([]);
    }

    const stage = String(req.query?.stage || "").toUpperCase();
    const limit = Math.min(Math.max(parseInt(req.query?.limit || "50", 10), 1), 200);
    const patientId = req.query?.patientId || null;
    const appointmentId = req.query?.appointmentId || null;
    const q = String(req.query?.q || "").trim();

    const stateFilter = {};
    if (stage === "LAB") {
      stateFilter.state = WORKFLOW.LAB_ORDERED;
    } else if (stage === "PHARMACY") {
      stateFilter.state = WORKFLOW.PRESCRIPTION_CREATED;
    }

    let scopedPatientFilter = patientId ? { patient: patientId } : {};
    if (role === "PATIENT") {
      const ownPatientIds = await resolvePatientIdsForUser(req.user._id || req.user.id, hospitalId || null);
      if (!ownPatientIds.length) return res.json([]);
      if (patientId && !ownPatientIds.includes(String(patientId))) {
        return res.status(403).json({ message: "You can only view your own encounter history" });
      }
      scopedPatientFilter = { patient: { $in: ownPatientIds } };
    }

    const encounterFilter = {
      ...(hospitalId ? { hospital: hospitalId } : {}),
      ...scopedPatientFilter,
      ...(appointmentId ? { appointment: appointmentId } : {}),
      ...stateFilter,
    };

    if (q) {
      encounterFilter.$or = buildBusinessIdSearchFilter(q, ["encounterId"], [
        { state: { $regex: q, $options: "i" } },
      ]).$or;
    }

    const rows = await Encounter.find(encounterFilter)
      .populate("patient", "firstName lastName")
      .populate("doctor", "name role")
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .lean();
    const systemSettings = await getSystemSettingsDoc({ lean: true });
    const hospital = hospitalId
      ? await Hospital.findById(hospitalId).select("features customization").lean()
      : null;
    const closeoutPolicy = resolveCloseoutPolicy(
      systemSettings,
      hospital?.features || {},
      hospital?.customization || {}
    );

    const encounterIds = rows.map((row) => String(row._id));
    const appointmentIds = rows
      .map((row) => (row?.appointment ? String(row.appointment) : ""))
      .filter(Boolean);
    const invoices = encounterIds.length
      ? await Financial.find({
          "metadata.encounterId": { $in: encounterIds },
          ...(hospitalId ? { hospital: hospitalId } : {}),
        })
          .select("_id invoiceNumber total status metadata")
          .lean()
      : [];
    const invoicesByEncounter = new Map(
      invoices.map((row) => [String(row?.metadata?.encounterId || ""), row])
    );
    const prescriptions =
      encounterIds.length || appointmentIds.length
        ? await Prescription.find({
            ...(hospitalId ? { hospital: hospitalId } : {}),
            $or: [
              ...(encounterIds.length ? [{ encounter: { $in: encounterIds } }] : []),
              ...(appointmentIds.length ? [{ appointment: { $in: appointmentIds } }] : []),
            ],
          })
            .select("_id encounter appointment summary status medications createdAt")
            .sort({ createdAt: -1, _id: -1 })
            .lean()
        : [];
    const escalationNotificationsRaw = encounterIds.length
      ? await Notification.find({
          hospital: hospitalId,
          "meta.type": "NURSE_ESCALATION",
        })
          .select("user read createdAt meta title body")
          .sort({ createdAt: -1, _id: -1 })
          .lean()
      : [];
    const encounterIdSet = new Set(encounterIds);
    const escalationNotifications = escalationNotificationsRaw.filter((row) =>
      encounterIdSet.has(String(row?.meta?.encounterId || ""))
    );
    const escalationResolverIds = [
      ...new Set(
        escalationNotifications
          .map((row) => String(row?.meta?.resolvedBy || ""))
          .filter(Boolean)
      ),
    ];
    const escalationResolvers = escalationResolverIds.length
      ? await User.find({ _id: { $in: escalationResolverIds } }).select("name role").lean()
      : [];
    const prescriptionsByEncounter = new Map();
    const prescriptionsByAppointment = new Map();
    const escalationsByEncounter = new Map();
    const escalationResolverById = new Map(
      escalationResolvers.map((row) => [String(row._id), row])
    );
    prescriptions.forEach((row) => {
      const encounterKey = row?.encounter ? String(row.encounter) : "";
      const appointmentKey = row?.appointment ? String(row.appointment) : "";
      if (encounterKey) {
        const current = prescriptionsByEncounter.get(encounterKey) || [];
        current.push(row);
        prescriptionsByEncounter.set(encounterKey, current);
      }
      if (appointmentKey) {
        const current = prescriptionsByAppointment.get(appointmentKey) || [];
        current.push(row);
        prescriptionsByAppointment.set(appointmentKey, current);
      }
    });
    escalationNotifications.forEach((row) => {
      const key = String(row?.meta?.encounterId || "");
      if (!key) return;
      const current = escalationsByEncounter.get(key) || [];
      current.push(row);
      escalationsByEncounter.set(key, current);
    });

    const items = rows.map((row) => ({
      ...row,
      patient: row.patient
        ? {
            ...row.patient,
            name: [row.patient.firstName, row.patient.lastName].filter(Boolean).join(" ").trim(),
          }
        : null,
      doctor: row.doctor
        ? {
            _id: row.doctor._id,
            name: row.doctor.name,
            role: row.doctor.role,
          }
        : null,
      labSummary: {
        count: Array.isArray(row.labOrders) ? row.labOrders.length : 0,
      },
      billing: (() => {
        const invoice = invoicesByEncounter.get(String(row._id));
        if (!invoice) return null;
        return {
          invoiceId: invoice._id,
          invoiceNumber: invoice.invoiceNumber,
          total: invoice.total,
          status: invoice.status,
        };
      })(),
      prescriptionSummary: (() => {
        const direct = prescriptionsByEncounter.get(String(row._id)) || [];
        const fallback = row?.appointment
          ? prescriptionsByAppointment.get(String(row.appointment)) || []
          : [];
        const linked = direct.length ? direct : fallback;
        if (!linked.length) return null;
        const latest = linked[0];
        return {
          count: linked.length,
          latestId: latest._id,
          latestStatus: latest.status,
          latestSummary: latest.summary || "",
          medicationCount: Array.isArray(latest.medications) ? latest.medications.length : 0,
        };
      })(),
      escalationSummary: (() => {
        const linked = escalationsByEncounter.get(String(row._id)) || [];
        if (!linked.length) return null;
        const latest = linked[0];
        const openItems = linked.filter((item) => !item?.meta?.resolvedAt);
        const latestOpen = openItems[0] || null;
        const unreadMine = linked.filter(
          (item) => String(item.user || "") === String(req.user?._id || req.user?.id || "") && !item.read
        ).length;
        return {
          count: linked.length,
          openCount: openItems.length,
          unreadMine,
          latestAt: latest.createdAt,
          latestTitle: (latestOpen || latest).title || "",
          latestBody: (latestOpen || latest).body || "",
          resolvedAt: latestOpen ? null : latest?.meta?.resolvedAt || null,
          resolvedBy:
            latestOpen || !latest?.meta?.resolvedBy
              ? null
              : (() => {
                  const user = escalationResolverById.get(String(latest.meta.resolvedBy));
                  return user
                    ? { _id: user._id, name: user.name, role: user.role }
                    : { _id: latest.meta.resolvedBy };
                })(),
          missingRequirements: Array.isArray((latestOpen || latest)?.meta?.missingRequirements)
            ? (latestOpen || latest).meta.missingRequirements
            : [],
        };
      })(),
      closeout: (() => {
        const billing = (() => {
          const invoice = invoicesByEncounter.get(String(row._id));
          if (!invoice) return null;
          return {
            invoiceId: invoice._id,
            invoiceNumber: invoice.invoiceNumber,
            total: invoice.total,
            status: invoice.status,
          };
        })();
        const prescriptionSummary = (() => {
          const direct = prescriptionsByEncounter.get(String(row._id)) || [];
          const fallback = row?.appointment
            ? prescriptionsByAppointment.get(String(row.appointment)) || []
            : [];
          const linked = direct.length ? direct : fallback;
          if (!linked.length) return null;
          const latest = linked[0];
          return {
            count: linked.length,
            latestId: latest._id,
            latestStatus: latest.status,
            latestSummary: latest.summary || "",
            medicationCount: Array.isArray(latest.medications) ? latest.medications.length : 0,
          };
        })();
        return {
          ...buildEncounterCloseoutSummary(row, {
            policy: closeoutPolicy,
            billing,
            prescriptionSummary,
          }),
          policy: closeoutPolicy,
        };
      })(),
      workflow: {
        state: row.state,
        allowedTransitions: toAllowedTransitions(row.state),
      },
    }));

    return res.json(items);
  } catch (err) {
    console.error("List encounters error:", err);
    return res.status(500).json({ message: "Failed to load encounters" });
  }
};

export const listEncounterEscalations = async (req, res) => {
  try {
    const hospitalId = resolveHospitalId(req);
    const role = String(req.user?.role || "").toUpperCase();
    if (!hospitalId) {
      return res.json({ items: [], clinicians: [], wards: [], total: 0, page: 1, pageSize: 25 });
    }

    const status = String(req.query?.status || "OPEN").toUpperCase();
    const missingRequirement = String(req.query?.missingRequirement || "").toUpperCase();
    const clinicianId = String(req.query?.clinicianId || "").trim();
    const ward = String(req.query?.ward || "").trim();
    const q = String(req.query?.q || "").trim().toLowerCase();
    const page = Math.max(parseInt(req.query?.page || "1", 10), 1);
    const pageSize = Math.min(Math.max(parseInt(req.query?.pageSize || "25", 10), 1), 100);
    const sort = String(req.query?.sort || "NEWEST").toUpperCase();

    const notifications = await Notification.find({
      hospital: hospitalId,
      "meta.type": "NURSE_ESCALATION",
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(pageSize * 20)
      .lean();

    const grouped = new Map();
    notifications.forEach((item) => {
      const key = String(item?.meta?.encounterId || "");
      if (!key) return;
      const current = grouped.get(key) || [];
      current.push(item);
      grouped.set(key, current);
    });

    const encounterIds = [...grouped.keys()];
    const encounters = encounterIds.length
      ? await Encounter.find({ _id: { $in: encounterIds }, hospital: hospitalId })
          .select("patient doctor state appointment")
          .populate("patient", "firstName lastName nationalId ward")
          .populate("doctor", "name role")
          .lean()
      : [];
    const encounterById = new Map(encounters.map((row) => [String(row._id), row]));

    const items = encounterIds
      .map((encounterId) => {
        const rows = grouped.get(encounterId) || [];
        const latest = rows[0] || null;
        const openRows = rows.filter((row) => !row?.meta?.resolvedAt);
        const reviewedRows = rows.filter((row) => row?.meta?.reviewedAt);
        const encounter = encounterById.get(encounterId);
        if (!encounter || !latest) return null;
        const patientName = [encounter?.patient?.firstName, encounter?.patient?.lastName].filter(Boolean).join(" ").trim() || "Patient";
        return {
          id: encounterId,
          encounterId,
          patientId: encounter?.patient?._id || null,
          patientName,
          nationalId: encounter?.patient?.nationalId || "",
          ward: encounter?.patient?.ward || "",
          clinicianId: encounter?.doctor?._id || null,
          clinicianName: encounter?.doctor?.name || "Doctor",
          clinicianRole: encounter?.doctor?.role || "",
          openCount: openRows.length,
          count: rows.length,
          status: openRows.length ? "OPEN" : "RESOLVED",
          latestAt: latest.createdAt,
          latestBody: (openRows[0] || latest)?.body || "",
          missingRequirements: Array.isArray((openRows[0] || latest)?.meta?.missingRequirements)
            ? (openRows[0] || latest).meta.missingRequirements
            : [],
          resolvedAt: openRows.length ? null : latest?.meta?.resolvedAt || null,
          reviewedAt: reviewedRows[0]?.meta?.reviewedAt || null,
          reviewedBy: reviewedRows[0]?.meta?.reviewedBy || null,
          path: (openRows[0] || latest)?.meta?.path || "",
        };
      })
      .filter(Boolean)
      .filter((item) => {
        if (role === "DOCTOR" && String(item.clinicianId || "") !== String(req.user?._id || req.user?.id || "")) {
          return false;
        }
        if (status !== "ALL" && item.status !== status) return false;
        if (missingRequirement && !item.missingRequirements.includes(missingRequirement)) return false;
        if (clinicianId && String(item.clinicianId || "") !== clinicianId) return false;
        if (ward && String(item.ward || "") !== ward) return false;
        if (q) {
          const haystack = [
            item.patientName,
            item.nationalId,
            item.ward,
            item.clinicianName,
            item.latestBody,
          ]
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      });

    const sorted = items.sort((a, b) => {
      if (sort === "OLDEST") {
        return new Date(a.latestAt).getTime() - new Date(b.latestAt).getTime();
      }
      if (sort === "PATIENT") {
        return String(a.patientName || "").localeCompare(String(b.patientName || ""));
      }
      if (sort === "CLINICIAN") {
        return String(a.clinicianName || "").localeCompare(String(b.clinicianName || ""));
      }
      if (sort === "WARD") {
        return String(a.ward || "").localeCompare(String(b.ward || ""));
      }
      if (sort === "PRIORITY") {
        return b.openCount - a.openCount || new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime();
      }
      return new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime();
    });

    const total = sorted.length;
    const start = (page - 1) * pageSize;
    const pagedItems = sorted.slice(start, start + pageSize);

    const clinicians = [...new Map(
      sorted
        .filter((item) => item.clinicianId)
        .map((item) => [String(item.clinicianId), { _id: item.clinicianId, name: item.clinicianName, role: item.clinicianRole }])
    ).values()];
    const wards = [...new Set(sorted.map((item) => String(item.ward || "")).filter(Boolean))].sort((a, b) => a.localeCompare(b));

    return res.json({ items: pagedItems, clinicians, wards, total, page, pageSize });
  } catch (err) {
    return res.status(500).json({ message: err?.message || "Failed to load escalation queue" });
  }
};

export const bulkResolveEncounterEscalations = async (req, res) => {
  try {
    const hospitalId = resolveHospitalId(req);
    const role = String(req.user?.role || "").toUpperCase();
    if (!hospitalId) {
      return res.status(400).json({ message: "Hospital context is required" });
    }
    if (!["DOCTOR", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role)) {
      return res.status(403).json({ message: "Only clinicians or admins can resolve escalations" });
    }

    const encounterIds = Array.isArray(req.body?.encounterIds)
      ? [...new Set(req.body.encounterIds.map((item) => String(item || "")).filter(Boolean))]
      : [];
    const note = String(req.body?.note || "Bulk escalation resolution from queue.").trim();
    if (!encounterIds.length) {
      return res.status(400).json({ message: "Select at least one escalation item" });
    }

    const encounterRows = await Encounter.find({
      _id: { $in: encounterIds },
      hospital: hospitalId,
      ...(role === "DOCTOR" ? { doctor: req.user._id || req.user.id } : {}),
    })
      .select("_id patient")
      .lean();
    const allowedEncounterIds = encounterRows.map((row) => String(row._id));
    if (!allowedEncounterIds.length) {
      return res.json({ ok: true, resolved: 0, encounters: 0 });
    }

    const notificationsRaw = await Notification.find({
      hospital: hospitalId,
      "meta.type": "NURSE_ESCALATION",
      "meta.resolvedAt": { $exists: false },
    });
    const notifications = notificationsRaw.filter((item) =>
      allowedEncounterIds.includes(String(item?.meta?.encounterId || ""))
    );
    if (!notifications.length) {
      return res.json({ ok: true, resolved: 0, encounters: allowedEncounterIds.length });
    }

    await Promise.all(
      notifications.map(async (item) => {
        item.meta = {
          ...(item.meta || {}),
          resolvedAt: new Date(),
          resolvedBy: req.user._id,
          resolutionNote: note,
        };
        if (String(item.user || "") === String(req.user._id || req.user.id || "")) {
          item.read = true;
        }
        await item.save();
      })
    );

    await AuditLog.create({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: "NURSE_ESCALATION_RESOLVE_BULK",
      resource: "Encounter",
      resourceId: allowedEncounterIds[0],
      hospital: hospitalId,
      success: true,
      metadata: {
        encounterIds: allowedEncounterIds,
        note,
        resolvedCount: notifications.length,
      },
    });

    return res.json({
      ok: true,
      resolved: notifications.length,
      encounters: allowedEncounterIds.length,
    });
  } catch (err) {
    return res.status(500).json({ message: err?.message || "Failed to bulk resolve escalations" });
  }
};

export const bulkAssignEncounterEscalations = async (req, res) => {
  try {
    const hospitalId = resolveHospitalId(req);
    const role = String(req.user?.role || "").toUpperCase();
    if (!hospitalId) {
      return res.status(400).json({ message: "Hospital context is required" });
    }
    if (!["HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role)) {
      return res.status(403).json({ message: "Only administrators can assign clinicians" });
    }

    const encounterIds = Array.isArray(req.body?.encounterIds)
      ? [...new Set(req.body.encounterIds.map((item) => String(item || "")).filter(Boolean))]
      : [];
    const clinicianId = String(req.body?.clinicianId || "").trim();
    if (!encounterIds.length || !clinicianId) {
      return res.status(400).json({ message: "Encounter IDs and clinician ID are required" });
    }

    const clinician = await User.findOne({
      _id: clinicianId,
      hospital: hospitalId,
      role: { $in: ["DOCTOR", "SURGEON"] },
      isActive: { $ne: false },
    }).select("_id name role");
    if (!clinician) {
      return res.status(404).json({ message: "Clinician not found or inactive" });
    }

    const encounters = await Encounter.find({
      _id: { $in: encounterIds },
      hospital: hospitalId,
    });
    if (!encounters.length) {
      return res.json({ ok: true, updated: 0 });
    }

    const updatedEncounterIds = [];
    for (const encounter of encounters) {
      encounter.doctor = clinician._id;
      encounter.$locals.viaWorkflow = true;
      await encounter.save();
      updatedEncounterIds.push(String(encounter._id));
    }

    const notificationsRaw = await Notification.find({
      hospital: hospitalId,
      "meta.type": "NURSE_ESCALATION",
    });
    const notifications = notificationsRaw.filter((item) =>
      updatedEncounterIds.includes(String(item?.meta?.encounterId || ""))
    );
    await Promise.all(
      notifications.map(async (item) => {
        item.meta = {
          ...(item.meta || {}),
          assignedClinician: clinician._id,
          assignedClinicianName: clinician.name,
          assignedClinicianRole: clinician.role,
          assignedAt: new Date(),
          assignedBy: req.user._id,
        };
        await item.save();
      })
    );

    await notify({
      title: "Escalation Assigned",
      body: "You have been assigned a ward escalation and should review pending handoffs.",
      category: "WORKFLOW",
      user: clinician._id,
      hospital: hospitalId,
      meta: {
        type: "ESCALATION_ASSIGN",
        encounterIds: updatedEncounterIds,
        assignedAt: new Date(),
        path: "/doctor/escalations",
      },
    });

    await AuditLog.create({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: "ESCALATION_ASSIGN_BULK",
      resource: "Encounter",
      resourceId: updatedEncounterIds[0],
      hospital: hospitalId,
      success: true,
      metadata: {
        encounterIds: updatedEncounterIds,
        clinicianId: clinician._id,
        clinicianName: clinician.name,
      },
    });

    return res.json({ ok: true, updated: updatedEncounterIds.length });
  } catch (err) {
    return res.status(500).json({ message: err?.message || "Failed to assign clinician" });
  }
};

export const bulkReviewEncounterEscalations = async (req, res) => {
  try {
    const hospitalId = resolveHospitalId(req);
    const role = String(req.user?.role || "").toUpperCase();
    if (!hospitalId) {
      return res.status(400).json({ message: "Hospital context is required" });
    }
    if (!["DOCTOR", "HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role)) {
      return res.status(403).json({ message: "Only clinicians or admins can mark escalations reviewed" });
    }

    const encounterIds = Array.isArray(req.body?.encounterIds)
      ? [...new Set(req.body.encounterIds.map((item) => String(item || "")).filter(Boolean))]
      : [];
    if (!encounterIds.length) {
      return res.status(400).json({ message: "Encounter IDs are required" });
    }

    const notificationsRaw = await Notification.find({
      hospital: hospitalId,
      "meta.type": "NURSE_ESCALATION",
      "meta.resolvedAt": { $exists: false },
    });
    const notifications = notificationsRaw.filter((item) =>
      encounterIds.includes(String(item?.meta?.encounterId || ""))
    );
    if (!notifications.length) {
      return res.json({ ok: true, reviewed: 0 });
    }

    await Promise.all(
      notifications.map(async (item) => {
        item.meta = {
          ...(item.meta || {}),
          reviewedAt: new Date(),
          reviewedBy: req.user._id,
        };
        await item.save();
      })
    );

    await AuditLog.create({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: "NURSE_ESCALATION_REVIEW_BULK",
      resource: "Encounter",
      resourceId: encounterIds[0],
      hospital: hospitalId,
      success: true,
      metadata: {
        encounterIds,
        reviewedCount: notifications.length,
      },
    });

    return res.json({ ok: true, reviewed: notifications.length });
  } catch (err) {
    return res.status(500).json({ message: err?.message || "Failed to mark escalations reviewed" });
  }
};

/**
 * CLOSE ENCOUNTER — WORKFLOW GUARDED
 * 🔒 Financially & clinically safe
 */
export const closeEncounter = async (req, res) => {
  try {
    const encounterId = req.params.id;
    const encounterDoc = await Encounter.findById(encounterId);
    if (!encounterDoc) {
      return res.status(404).json({ error: "Encounter not found" });
    }
    const actorHospitalId = resolveHospitalId(req);
    if (actorHospitalId && String(encounterDoc.hospital) !== String(actorHospitalId)) {
      return res.status(404).json({ error: "Encounter not found" });
    }

    /* ===============================
       🔐 INSURANCE / PAYMENT CHECK
    =============================== */

    // Check insurance (if encounter is insured)
    const insuranceAuth = await InsuranceAuthorization.findOne({
      encounter: encounterId,
    });

    if (
      insuranceAuth &&
      insuranceAuth.status !== "APPROVED"
    ) {
      return res.status(403).json({
        error:
          "Encounter cannot be closed — insurance not approved",
      });
    }

    // Check outstanding payments
    const unpaid = await Invoice.findOne({
      encounter: encounterId,
      status: { $ne: "Paid" },
    });

    if (unpaid) {
      return res.status(403).json({
        error:
          "Encounter cannot be closed — pending payment",
      });
    }

    const [systemSettings, hospital, invoice, prescriptions] = await Promise.all([
      getSystemSettingsDoc({ lean: true }),
      Hospital.findById(encounterDoc.hospital).select("features customization").lean(),
      Financial.findOne({
        "metadata.encounterId": String(encounterId),
        ...(encounterDoc.hospital ? { hospital: encounterDoc.hospital } : {}),
      })
        .select("_id invoiceNumber total status")
        .lean(),
      Prescription.find({
        hospital: encounterDoc.hospital,
        $or: [
          { encounter: encounterId },
          ...(encounterDoc.appointment ? [{ appointment: encounterDoc.appointment }] : []),
        ],
      })
        .select("_id summary status medications")
        .sort({ createdAt: -1, _id: -1 })
        .lean(),
    ]);

    const prescriptionSummary = prescriptions.length
      ? {
          count: prescriptions.length,
          latestId: prescriptions[0]._id,
          latestStatus: prescriptions[0].status,
          latestSummary: prescriptions[0].summary || "",
          medicationCount: Array.isArray(prescriptions[0].medications) ? prescriptions[0].medications.length : 0,
        }
      : null;
    const closeoutPolicy = resolveCloseoutPolicy(
      systemSettings,
      hospital?.features || {},
      hospital?.customization || {}
    );
    const closeout = buildEncounterCloseoutSummary(encounterDoc, {
      policy: closeoutPolicy,
      billing: invoice
        ? {
            invoiceId: invoice._id,
            invoiceNumber: invoice.invoiceNumber,
            total: invoice.total,
            status: invoice.status,
          }
        : null,
      prescriptionSummary,
    });
    if (!closeout.canClose) {
      return res.status(409).json({
        error: "Encounter cannot be closed — required closeout handoffs are missing",
        code: "CLOSEOUT_REQUIREMENTS_MISSING",
        closeout,
      });
    }

    /* ===============================
       🔄 WORKFLOW TRANSITION
    =============================== */
    const encounter = await workflowService.transitionEncounter(
      encounterId,
      WORKFLOW.CLOSED,
      {
        actorId: req.user._id,
        actorRole: req.user.role,
        reason: "Encounter closed",
      }
    );

    res.json(encounter);
  } catch (err) {
    console.error("Close encounter failed:", err);
    res.status(500).json({
      error: err.message || "Failed to close encounter",
    });
  }
};

export const createNurseEscalation = async (req, res) => {
  try {
    const hospitalId = resolveHospitalId(req);
    const role = String(req.user?.role || "").toUpperCase();
    if (!hospitalId) {
      return res.status(400).json({ message: "Hospital context is required" });
    }
    if (!["NURSE", "HOSPITAL_ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role)) {
      return res.status(403).json({ message: "Only clinical operations staff can escalate visit blockers" });
    }

    const encounter = await Encounter.findOne({ _id: req.params.id, hospital: hospitalId })
      .populate("patient", "firstName lastName")
      .populate("doctor", "name role");
    if (!encounter) {
      return res.status(404).json({ message: "Encounter not found" });
    }

    const systemSettings = await getSystemSettingsDoc({ lean: true });
    const hospital = await Hospital.findById(hospitalId).select("features customization").lean();
    const policy = resolveCloseoutPolicy(
      systemSettings,
      hospital?.features || {},
      hospital?.customization || {}
    );
    const billing = await Financial.findOne({
      hospital: hospitalId,
      "metadata.encounterId": String(encounter._id),
    })
      .select("_id invoiceNumber total status metadata")
      .lean();
    const prescriptionRows = await Prescription.find({
      hospital: hospitalId,
      $or: [
        { encounter: encounter._id },
        ...(encounter.appointment ? [{ appointment: encounter.appointment }] : []),
      ],
    })
      .select("_id status summary medications createdAt")
      .sort({ createdAt: -1, _id: -1 })
      .lean();
    const prescriptionSummary = {
      count: prescriptionRows.length,
      latestStatus: prescriptionRows[0]?.status || null,
      latestSummary: prescriptionRows[0]?.summary || "",
      medicationCount: Array.isArray(prescriptionRows[0]?.medications) ? prescriptionRows[0].medications.length : 0,
    };
    const closeout = buildEncounterCloseoutSummary(encounter, { policy, billing, prescriptionSummary });

    const missingRequirements = Array.isArray(closeout?.missingRequirements) ? closeout.missingRequirements : [];
    const note = String(req.body?.note || "").trim();
    const patientName = [encounter?.patient?.firstName, encounter?.patient?.lastName].filter(Boolean).join(" ").trim() || "patient";
    const title = missingRequirements.length
      ? "Nurse Escalation: Visit Handoffs Missing"
      : "Nurse Escalation: Clinical Review Requested";
    const body = missingRequirements.length
      ? `${patientName} cannot be discharged or transferred yet. Missing: ${missingRequirements.join(", ")}.${note ? ` Note: ${note}` : ""}`
      : `${patientName} needs clinician review before ward movement.${note ? ` Note: ${note}` : ""}`;

    // Notify assigned doctor directly
    let recipientCount = 0;
    if (encounter.doctor?._id) {
      try {
        await notify({
          user: encounter.doctor._id,
          hospital: hospitalId,
          title,
          body,
          category: "WORKFLOW",
          meta: {
            type: "NURSE_ESCALATION",
            encounterId: encounter._id,
            patientId: encounter.patient?._id,
            missingRequirements,
            path: `/doctor/opd?patientId=${encodeURIComponent(String(encounter.patient?._id || ""))}${
              missingRequirements[0] ? `&focus=${encodeURIComponent(missingRequirements[0])}` : ""
            }`,
          },
        });
        recipientCount += 1;
      } catch (err) {
        console.error("Failed to notify assigned clinician for escalation:", err);
      }
    }

    // Notify hospital admin / ops staff
    try {
      await notifyRolesInHospital({
        hospital: hospitalId,
        roles: ["HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT"],
        title,
        body,
        category: "WORKFLOW",
        meta: {
          type: "NURSE_ESCALATION",
          encounterId: encounter._id,
          patientId: encounter.patient?._id,
          missingRequirements,
          path: `/hospital-admin/ward-board`,
        },
      });
      // opsUsers count for audit
      const opsUsers = await User.find({
        hospital: hospitalId,
        role: { $in: ["HOSPITAL_ADMIN", "HOSPITAL_ADMIN_ASSISTANT"] },
        isActive: { $ne: false },
      }).select("_id");
      recipientCount += opsUsers.length;
    } catch (err) {
      console.error("Failed to notify hospital admins for escalation:", err);
    }

    await AuditLog.create({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: "NURSE_ESCALATION_CREATE",
      resource: "Encounter",
      resourceId: encounter._id,
      hospital: hospitalId,
      success: true,
      metadata: {
        patientId: encounter.patient?._id,
        missingRequirements,
        note,
        recipientCount,
      },
    });

    return res.status(201).json({
      ok: true,
      recipients: recipientCount,
      missingRequirements,
    });
  } catch (err) {
    return res.status(500).json({ message: err?.message || "Failed to create escalation" });
  }
};

export const resolveNurseEscalation = async (req, res) => {
  try {
    const hospitalId = resolveHospitalId(req);
    const role = String(req.user?.role || "").toUpperCase();
    if (!hospitalId) {
      return res.status(400).json({ message: "Hospital context is required" });
    }
    if (!["DOCTOR", "HOSPITAL_ADMIN", "SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role)) {
      return res.status(403).json({ message: "Only clinicians or admins can resolve escalations" });
    }

    const encounter = await Encounter.findOne({ _id: req.params.id, hospital: hospitalId })
      .populate("patient", "firstName lastName");
    if (!encounter) {
      return res.status(404).json({ message: "Encounter not found" });
    }

    const note = String(req.body?.note || "").trim();
    const notificationsRaw = await Notification.find({
      hospital: hospitalId,
      "meta.type": "NURSE_ESCALATION",
      "meta.resolvedAt": { $exists: false },
    });
    const notifications = notificationsRaw.filter(
      (item) => String(item?.meta?.encounterId || "") === String(encounter._id)
    );

    if (!notifications.length) {
      return res.json({ ok: true, resolved: 0 });
    }

    await Promise.all(
      notifications.map(async (item) => {
        item.meta = {
          ...(item.meta || {}),
          resolvedAt: new Date(),
          resolvedBy: req.user._id,
          resolutionNote: note,
        };
        if (String(item.user || "") === String(req.user._id || req.user.id || "")) {
          item.read = true;
        }
        await item.save();
      })
    );

    await AuditLog.create({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: "NURSE_ESCALATION_RESOLVE",
      resource: "Encounter",
      resourceId: encounter._id,
      hospital: hospitalId,
      success: true,
      metadata: {
        patientId: encounter.patient?._id,
        note,
        resolvedCount: notifications.length,
      },
    });

    return res.json({ ok: true, resolved: notifications.length });
  } catch (err) {
    return res.status(500).json({ message: err?.message || "Failed to resolve escalation" });
  }
};

export const applyEncounterCloseoutEffects = async (req, res) => {
  try {
    const encounter = await Encounter.findById(req.params.id);
    if (!encounter) {
      return res.status(404).json({ error: "Encounter not found" });
    }

    const actorHospitalId = resolveHospitalId(req);
    if (String(encounter.hospital) !== String(actorHospitalId)) {
      return res.status(404).json({ error: "Encounter not found" });
    }

    const patientRecord = await Patient.findById(encounter.patient).lean();
    const patientUserId = patientRecord?.metadata?.userId || null;

    const diagnosisText = String(req.body?.diagnosis || "").trim();
    const diagnosisCode = String(req.body?.diagnosisCode || "").trim();
    const labTests = Array.isArray(req.body?.labTests)
      ? req.body.labTests
      : String(req.body?.labTests || "")
          .split(",")
          .map((item) => String(item || "").trim())
          .filter(Boolean);

    let diagnosisRecord = null;
    if (diagnosisText && patientUserId) {
      diagnosisRecord = await Diagnosis.findOne({
        encounter: encounter._id,
        doctor: req.user._id,
        hospital: encounter.hospital,
      });
      if (!diagnosisRecord) {
        diagnosisRecord = new Diagnosis({
          encounter: encounter._id,
          patient: patientUserId,
          doctor: req.user._id,
          hospital: encounter.hospital,
          code: diagnosisCode || undefined,
          description: diagnosisText,
        });
        diagnosisRecord.$locals = { ...(diagnosisRecord.$locals || {}), viaWorkflow: true };
        await diagnosisRecord.save();
      }
    }

    const createdLabOrders = [];
    if (labTests.length && patientUserId) {
      const existingOrders = await LabOrder.find({
        encounter: encounter._id,
        testName: { $in: labTests },
      }).lean();
      const existingNames = new Set(existingOrders.map((row) => String(row.testName || "").trim().toLowerCase()));
      for (const testName of labTests) {
        const key = String(testName || "").trim().toLowerCase();
        if (!key || existingNames.has(key)) continue;
        const lab = new LabOrder({
          encounter: encounter._id,
          patient: patientUserId,
          hospital: encounter.hospital,
          testName: testName,
          status: "Pending",
        });
        lab.$locals = { ...(lab.$locals || {}), viaWorkflow: true };
        await lab.save();
        createdLabOrders.push(lab);
      }
    }

    if (diagnosisText) {
      encounter.diagnosis = diagnosisText;
    }
    if (createdLabOrders.length) {
      encounter.labOrders = [
        ...(Array.isArray(encounter.labOrders) ? encounter.labOrders : []),
        ...createdLabOrders.map((row) => row._id),
      ];
      if (encounter.state !== WORKFLOW.CLOSED) {
        encounter.state = WORKFLOW.LAB_ORDERED;
      }
    }
    encounter.$locals = { ...(encounter.$locals || {}), viaWorkflow: true };
    await encounter.save();

    await AuditLog.create({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: "ENCOUNTER_CLOSEOUT_EFFECTS",
      resource: "Encounter",
      resourceId: encounter._id,
      hospital: encounter.hospital,
      success: true,
      metadata: {
        diagnosisCreated: Boolean(diagnosisRecord),
        diagnosisCode: diagnosisCode || "",
        labOrdersCreated: createdLabOrders.length,
      },
    });

    return res.json({
      message: "Closeout effects applied",
      encounter,
      diagnosis: diagnosisRecord,
      labOrders: createdLabOrders,
    });
  } catch (err) {
    console.error("Apply encounter closeout effects failed:", err);
    return res.status(500).json({
      error: err.message || "Failed to apply closeout effects",
    });
  }
};

function parseBillingItems(rawItems = []) {
  if (Array.isArray(rawItems)) {
    return rawItems
      .map((item) => {
        if (typeof item === "string") {
          const [descriptionPart, amountPart] = String(item).split(":");
          return {
            description: String(descriptionPart || "").trim(),
            amount: Number(String(amountPart || "").trim()),
          };
        }
        return {
          description: String(item?.description || "").trim(),
          amount: Number(item?.amount || 0),
        };
      })
      .filter((item) => item.description && Number.isFinite(item.amount) && item.amount > 0);
  }

  return String(rawItems || "")
    .split("\n")
    .map((line) => String(line || "").trim())
    .filter(Boolean)
    .map((line) => {
      const [descriptionPart, amountPart] = line.split(":");
      return {
        description: String(descriptionPart || "").trim(),
        amount: Number(String(amountPart || "").trim()),
      };
    })
    .filter((item) => item.description && Number.isFinite(item.amount) && item.amount > 0);
}

export const createEncounterBillingHandoff = async (req, res) => {
  try {
    const encounter = await Encounter.findById(req.params.id);
    if (!encounter) {
      return res.status(404).json({ error: "Encounter not found" });
    }

    const actorHospitalId = resolveHospitalId(req);
    if (String(encounter.hospital) !== String(actorHospitalId)) {
      return res.status(404).json({ error: "Encounter not found" });
    }

    const existingInvoice = await Financial.findOne({
      hospital: encounter.hospital,
      "metadata.encounterId": String(encounter._id),
    });
    if (existingInvoice) {
      return res.status(409).json({ error: "Billing handoff already exists for this encounter" });
    }

    const items = parseBillingItems(req.body?.items);
    const fallbackItems = [
      {
        description: "Encounter services",
        amount: 0,
      },
    ];
    const normalizedItems = items.length ? items : fallbackItems;

    const total = normalizedItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const invoice = await Financial.create({
      hospital: encounter.hospital,
      patient: encounter.patient,
      invoiceNumber: "INV-" + uuidv4().slice(0, 8).toUpperCase(),
      items: normalizedItems,
      total,
      status: "Pending",
      metadata: {
        encounterId: String(encounter._id),
        source: "ENCOUNTER_CLOSEOUT",
      },
    });

    await AuditLog.create({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: "ENCOUNTER_BILLING_HANDOFF",
      resource: "Financial",
      resourceId: invoice._id,
      hospital: encounter.hospital,
      success: true,
      metadata: {
        encounterId: String(encounter._id),
        invoiceNumber: invoice.invoiceNumber,
        total,
        itemCount: normalizedItems.length,
      },
    });

    return res.json({
      message: "Billing handoff created",
      invoice,
    });
  } catch (err) {
    console.error("Create encounter billing handoff failed:", err);
    return res.status(500).json({
      error: err.message || "Failed to create billing handoff",
    });
  }
};
