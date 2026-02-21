import { generateMedicalLegalReport } from "../services/medicalLegalReportService.js";
import Encounter from "../models/Encounter.js";
import { normalizeRole } from "../utils/normalizeRole.js";
import AuditLog from "../models/AuditLog.js";

export async function exportMedicalLegal(req, res) {
  try {
    const { encounterId } = req.params;
    const encounter =
      req.encounter ||
      (await Encounter.findById(encounterId).select("hospital patient doctor").lean());
    if (!encounter) {
      return res.status(404).json({ message: "Encounter not found" });
    }

    const role = normalizeRole(req.user?.role || "");
    const privileged = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DEVELOPER"].includes(role);
    const userHospital = String(req.user?.hospital || req.user?.hospitalId || "");
    const encounterHospital = String(encounter.hospital || "");

    if (!privileged && userHospital && encounterHospital && userHospital !== encounterHospital) {
      await AuditLog.create({
        actorId: req.user?._id,
        actorRole: req.user?.role,
        action: "ACCESS_DENIED",
        resource: "MEDICAL_LEGAL_REPORT",
        resourceId: encounterId,
        hospital: req.user?.hospital || req.user?.hospitalId,
        success: false,
        error: "Cross-hospital export blocked",
      });
      return res.status(403).json({ message: "Cross-hospital access denied" });
    }

    const report = await generateMedicalLegalReport(encounterId);
    await AuditLog.create({
      actorId: req.user?._id,
      actorRole: req.user?.role,
      action: "MEDICAL_LEGAL_REPORT_EXPORTED",
      resource: "Encounter",
      resourceId: encounterId,
      hospital: encounter.hospital,
      metadata: { patient: encounter.patient, doctor: encounter.doctor },
      success: true,
    });

    return res.json({
      type: "MEDICAL_LEGAL_REPORT",
      generatedAt: new Date(),
      report,
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed to export medical-legal report" });
  }
}
