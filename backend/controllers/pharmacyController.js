import Workflow from "../models/Workflow.js";
import Prescription from "../models/Prescription.js";
import PharmacyItem from "../models/PharmacyItem.js";
import InsuranceAuthorization from "../models/InsuranceAuthorization.js";
import Appointment from "../models/Appointment.js";
import Patient from "../models/Patient.js";
import Notification from "../models/Notification.js";
import AuditLog from "../models/AuditLog.js";
import PharmacyReferral from "../models/PharmacyReferral.js";
import RegisteredPharmacy from "../models/RegisteredPharmacy.js";
import { assertWorkflowState } from "../services/clinicalWorkflowGuard.js";
import { getIO } from "../utils/socket.js";

async function resolveActorPharmacyIds(req) {
  const direct = req.user?.registeredPharmacy ? [String(req.user.registeredPharmacy)] : [];
  if (direct.length) return direct;

  const email = String(req.user?.email || "").trim().toLowerCase();
  const phone = String(req.user?.phone || "").trim();
  if (!email && !phone) return [];

  const or = [];
  if (email) or.push({ "contact.email": email });
  if (phone) or.push({ "contact.phone": phone });
  if (!or.length) return [];

  const pharmacies = await RegisteredPharmacy.find({ $or: or, status: "ACTIVE" }).select("_id").lean();
  return pharmacies.map((item) => String(item._id));
}

/* ======================================================
   CREATE PRESCRIPTION (WORKFLOW LOCKED)
   State: LAB_COMPLETED → PRESCRIPTION_CREATED
====================================================== */
export async function createPrescription(req, res) {
  try {
    const { encounterId, appointmentId, meds, summary = "", advice = "" } = req.body;

    if ((!encounterId && !appointmentId) || !Array.isArray(meds) || meds.length === 0) {
      return res.status(400).json({
        error: "appointmentId or encounterId and meds are required",
      });
    }
    const candidateMeds = meds
      .map((item) => ({
        pharmacyItem: item?.pharmacyItem || item?.pharmacyItemId || null,
        name: String(item?.name || "").trim(),
        sku: String(item?.sku || "").trim(),
        unit: String(item?.unit || "").trim(),
        dosage: String(item?.dosage || "").trim(),
        frequency: String(item?.frequency || "").trim(),
        duration: String(item?.duration || "").trim(),
        requestedQuantity: Math.max(0, Number(item?.requestedQuantity || 0)),
      }))
      .filter((item) => item.name);

    const itemIds = [
      ...new Set(
        candidateMeds
          .map((item) => (item.pharmacyItem ? String(item.pharmacyItem) : ""))
          .filter(Boolean)
      ),
    ];
    const inventoryById = new Map();
    if (itemIds.length) {
      const rows = await PharmacyItem.find({
        _id: { $in: itemIds },
        hospital: req.user.hospital,
        active: { $ne: false },
      })
        .select("name sku unit totalQuantity minStock")
        .lean();
      rows.forEach((row) => inventoryById.set(String(row._id), row));
    }

    const cleanedMeds = candidateMeds
      .map((item) => {
        const linked = item.pharmacyItem ? inventoryById.get(String(item.pharmacyItem)) : null;
        const totalQuantity = linked ? Number(linked.totalQuantity || 0) : null;
        const minStock = linked ? Number(linked.minStock || 0) : 0;
        const stockStatus = !linked
          ? "UNLINKED"
          : totalQuantity <= 0
            ? "OUT_OF_STOCK"
            : minStock > 0 && totalQuantity <= minStock
              ? "LOW_STOCK"
              : "AVAILABLE";
        return {
          pharmacyItem: linked?._id || null,
          name: linked?.name || item.name,
          sku: linked?.sku || item.sku || "",
          unit: linked?.unit || item.unit || "",
          dosage: item.dosage,
          frequency: item.frequency,
          duration: item.duration,
          requestedQuantity: item.requestedQuantity,
          availableQuantityAtPrescription: totalQuantity,
          stockStatus,
        };
      })
      .filter((item) => item.name);

    if (!cleanedMeds.length) {
      return res.status(400).json({ error: "At least one medication name is required" });
    }
    const unavailable = cleanedMeds.filter((item) => item.pharmacyItem && item.stockStatus === "OUT_OF_STOCK");
    if (unavailable.length) {
      return res.status(409).json({
        error: "One or more selected medicines are out of stock",
        unavailable: unavailable.map((item) => ({
          pharmacyItem: item.pharmacyItem,
          name: item.name,
          stockStatus: item.stockStatus,
        })),
      });
    }

    let appointment = null;
    let patientRecord = null;
    let patientUserId = null;
    let workflow = null;

    if (appointmentId) {
      appointment = await Appointment.findById(appointmentId).populate("patient", "_id metadata firstName lastName");
      if (!appointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }
      patientRecord = appointment.patient || null;
      patientUserId = patientRecord?.metadata?.userId || null;
    }

    if (encounterId) {
      workflow = await Workflow.findOne({ encounter: encounterId });
      assertWorkflowState(workflow, ["LAB_COMPLETED"]);
    }

    if (!patientRecord && appointment?.patient) {
      patientRecord = appointment.patient;
    }
    if (!patientUserId && patientRecord?.metadata?.userId) {
      patientUserId = patientRecord.metadata.userId;
    }
    if (!patientUserId) {
      return res.status(422).json({ error: "Patient user account is required before prescribing" });
    }

    /* ================= DUPLICATE GUARD ================= */
    const existing = await Prescription.findOne({
      ...(appointmentId ? { appointment: appointmentId } : { encounter: encounterId }),
    });

    if (existing) {
      return res.status(409).json({
        error: "Prescription already created for this visit",
      });
    }

    /* ================= CREATE RX ================= */
    const rx = new Prescription({
      encounter: encounterId || null,
      appointment: appointmentId || null,
      patient: patientUserId,
      patientRecord: patientRecord?._id || null,
      doctor: req.user._id,
      hospital: req.user.hospital,
      medications: cleanedMeds,
      summary: String(summary || "").trim(),
      advice: String(advice || "").trim(),
      status: "CREATED",
    });
    rx.$locals = { ...(rx.$locals || {}), viaWorkflow: true };
    await rx.save();

    /* ================= TRANSITION ================= */
    if (workflow?.transition) {
      await workflow.transition("PRESCRIPTION_CREATED", req.user);
    }

    if (appointment) {
      appointment.$locals = { ...(appointment.$locals || {}), viaWorkflow: true };
      appointment.metadata = {
        ...(appointment.metadata || {}),
        prescriptionId: rx._id,
        prescriptionDraft: {
          medications: cleanedMeds,
          summary: String(summary || "").trim(),
          advice: String(advice || "").trim(),
          patientId: String(patientRecord?._id || ""),
        },
        consultationSummary: {
          ...(appointment.metadata?.consultationSummary || {}),
          prescriptionSummary: String(summary || "").trim(),
          prescriptionAdvice: String(advice || "").trim(),
          carePlan: appointment.metadata?.consultationSummary?.carePlan || "",
        },
      };
      await appointment.save();
    }

    await Notification.create({
      title: "Prescription Created",
      body: "Your doctor created a prescription for your visit.",
      category: "PHARMACY",
      user: patientUserId,
      hospital: req.user.hospital,
      meta: {
        prescriptionId: rx._id,
        appointmentId: appointmentId || null,
        path: "/patient/prescriptions",
      },
    });

    try {
      getIO().to(String(patientUserId)).emit("prescription_issued", {
        prescriptionId: String(rx._id),
        appointmentId: appointmentId || null,
        hospitalId: req.user.hospital ? String(req.user.hospital) : null,
        status: rx.status,
        message: "Medication Ready",
        path: "/patient/prescriptions",
        emittedAt: new Date().toISOString(),
      });
    } catch (_) {}

    await AuditLog.create({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: "PRESCRIPTION_CREATE",
      resource: "Prescription",
      resourceId: rx._id,
      hospital: req.user.hospital,
      success: true,
      metadata: {
        appointmentId: appointmentId || null,
        encounterId: encounterId || null,
        patientUserId,
        medicationCount: cleanedMeds.length,
      },
    });

    return res.json(rx);
  } catch (err) {
    console.error("Create prescription error:", err);
    return res.status(400).json({
      error: err.message || "Failed to create prescription",
    });
  }
}

export async function listPrescriptions(req, res) {
  try {
    const role = String(req.user?.role || "").toUpperCase();
    const filter = { hospital: req.user.hospital };

    if (req.query?.appointmentId) filter.appointment = req.query.appointmentId;
    if (req.query?.patientId) filter.patientRecord = req.query.patientId;

    if (role === "DOCTOR") {
      filter.doctor = req.user._id;
    }

    if (role === "PATIENT") {
      const records = await Patient.find({ "metadata.userId": req.user._id }).select("_id");
      const recordIds = records.map((item) => item._id);
      filter.$or = [{ patient: req.user._id }, { patientRecord: { $in: recordIds } }];
    }

    if (role === "PHARMACIST") {
      const pharmacyIds = await resolveActorPharmacyIds(req);
      if (!pharmacyIds.length) {
        return res.status(403).json({ error: "Pharmacist account is not linked to a registered pharmacy" });
      }
      const referrals = await PharmacyReferral.find({
        pharmacy: { $in: pharmacyIds },
        prescription: { $ne: null },
      })
        .select("prescription")
        .lean();
      const prescriptionIds = referrals
        .map((item) => item.prescription)
        .filter(Boolean);

      if (!prescriptionIds.length) {
        return res.json({ items: [] });
      }

      filter._id = { $in: prescriptionIds };
    }

    const rows = await Prescription.find(filter)
      .populate("appointment", "scheduledAt serviceType status metadata")
      .populate("patientRecord", "firstName lastName contact")
      .populate("doctor", "name")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    return res.json({ items: rows });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to list prescriptions" });
  }
}

/* ======================================================
   DISPENSE MEDICATION (INSURANCE + WORKFLOW GUARDED)
   State: PRESCRIPTION_CREATED → DISPENSED
====================================================== */
export async function dispenseMedication(req, res) {
  try {
    const { encounterId, prescriptionId } = req.body;

    if (!prescriptionId) {
      return res.status(400).json({
        error: "prescriptionId is required",
      });
    }

    /* ================= INSURANCE GUARD ================= */
    const rx = await Prescription.findById(prescriptionId);

    if (!rx) {
      return res.status(404).json({
        error: "Prescription not found",
      });
    }

    if (rx.status === "DISPENSED") {
      return res.status(409).json({
        error: "Medication already dispensed",
      });
    }

    if (String(req.user?.role || "").toUpperCase() === "PHARMACIST") {
      const pharmacyIds = await resolveActorPharmacyIds(req);
      if (!pharmacyIds.length) {
        return res.status(403).json({ error: "Pharmacist account is not linked to a registered pharmacy" });
      }
      const allowedReferral = await PharmacyReferral.findOne({
        prescription: rx._id,
        pharmacy: { $in: pharmacyIds },
      })
        .select("_id")
        .lean();
      if (!allowedReferral) {
        return res.status(403).json({ error: "Prescription is outside your pharmacy scope" });
      }
    }

    let workflow = null;
    if (encounterId || rx.encounter) {
      workflow = await Workflow.findOne({ encounter: encounterId || rx.encounter });
      if (workflow) {
        assertWorkflowState(workflow, ["PRESCRIPTION_CREATED"]);
        const auth = await InsuranceAuthorization.findOne({
          encounter: encounterId || rx.encounter,
          status: "APPROVED",
        });

        if (!auth) {
          return res.status(403).json({
            error: "Insurance authorization required before dispensing",
          });
        }
      }
    }

    /* ================= DISPENSE ================= */
    rx.status = "DISPENSED";
    rx.dispensedBy = req.user._id;
    rx.dispensedAt = new Date();
    rx.$locals = { ...(rx.$locals || {}), viaWorkflow: true };
    await rx.save();

    /* ================= TRANSITION ================= */
    if (workflow?.transition) {
      await workflow.transition("DISPENSED", req.user);
    }

    await Notification.insertMany([
      {
        title: "Prescription Dispensed",
        body: "Your medicine has been marked as dispensed.",
        category: "PHARMACY",
        user: rx.patient,
        hospital: rx.hospital,
        meta: {
          prescriptionId: rx._id,
          appointmentId: rx.appointment || null,
          dispensedAt: rx.dispensedAt,
          path: "/patient/prescriptions",
        },
      },
      {
        title: "Prescription Dispensed",
        body: "A prescription for your patient was dispensed.",
        category: "PHARMACY",
        user: rx.doctor,
        hospital: rx.hospital,
        meta: {
          prescriptionId: rx._id,
          appointmentId: rx.appointment || null,
          patientRecordId: rx.patientRecord || null,
          path: "/doctor/prescriptions",
        },
      },
    ]);

    await AuditLog.create({
      actorId: req.user._id,
      actorRole: req.user.role,
      action: "PRESCRIPTION_DISPENSE",
      resource: "Prescription",
      resourceId: rx._id,
      hospital: rx.hospital,
      success: true,
      metadata: {
        appointmentId: rx.appointment || null,
        encounterId: rx.encounter || null,
        patientUserId: rx.patient,
        dispensedAt: rx.dispensedAt,
      },
    });

    return res.json({
      status: "dispensed",
      prescription: rx,
    });
  } catch (err) {
    console.error("Dispense error:", err);
    return res.status(400).json({
      error: err.message || "Failed to dispense medication",
    });
  }
}
