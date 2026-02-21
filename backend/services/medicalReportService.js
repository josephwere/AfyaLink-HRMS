import PDFDocument from "pdfkit";

/**
 * MEDICAL–LEGAL REPORT PDF
 * 🔒 Immutable
 * ⚖️ Court-ready
 */
export function generateMedicalReport({
  encounter,
  workflow,
  audit,
  hospital,
}) {
  const doc = new PDFDocument({ margin: 40 });

  /* ================= HEADER ================= */
  doc
    .fontSize(18)
    .text("MEDICAL–LEGAL REPORT", { align: "center" })
    .moveDown();

  doc
    .fontSize(10)
    .text(`Hospital: ${hospital.name}`)
    .text(`Generated At: ${new Date().toLocaleString()}`)
    .moveDown();

  /* ================= PATIENT ================= */
  doc.fontSize(14).text("Patient Information").moveDown(0.5);

  doc
    .fontSize(10)
    .text(`Name: ${encounter.patient.name}`)
    .text(`Gender: ${encounter.patient.gender || "—"}`)
    .text(`DOB: ${encounter.patient.dob || "—"}`)
    .moveDown();

  /* ================= ENCOUNTER ================= */
  doc.fontSize(14).text("Encounter Summary").moveDown(0.5);

  doc
    .fontSize(10)
    .text(`Encounter ID: ${encounter._id}`)
    .text(`Reason: ${encounter.reason || "—"}`)
    .text(`Created At: ${new Date(encounter.createdAt).toLocaleString()}`)
    .moveDown();

  /* ================= CLINICAL ================= */
  doc.fontSize(14).text("Clinical Notes").moveDown(0.5);

  doc
    .fontSize(10)
    .text(encounter.notes || "No clinical notes recorded.")
    .moveDown();

  /* ================= WORKFLOW ================= */
  doc.fontSize(14).text("Workflow Timeline").moveDown(0.5);

  workflow.history.forEach((h) => {
    doc
      .fontSize(10)
      .text(
        `${new Date(h.at).toLocaleString()} — ${h.state} — by ${h.by || "system"}`
      );
  });

  doc.moveDown();

  /* ================= AUDIT ================= */
  doc.fontSize(14).text("Audit Trail").moveDown(0.5);

  audit.forEach((a) => {
    doc
      .fontSize(10)
      .text(
        `${new Date(a.at).toLocaleString()} — ${a.action} — ${a.actorRole}`
      );
  });

  doc.end();
  return doc;
}
