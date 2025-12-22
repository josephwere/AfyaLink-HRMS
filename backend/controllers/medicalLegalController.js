import { generateMedicalLegalReport } from "../services/medicalLegalReportService.js";

export async function exportMedicalLegal(req, res) {
  const { encounterId } = req.params;

  const report = await generateMedicalLegalReport(encounterId);

  res.json({
    type: "MEDICAL_LEGAL_REPORT",
    generatedAt: new Date(),
    report,
  });
}
