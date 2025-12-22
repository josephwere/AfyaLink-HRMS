import Transaction from "../models/Transaction.js";
import PDFDocument from "pdfkit";
import workflowService from "../services/workflowService.js";


/* ======================================================
   BILLING DASHBOARD (SAFE)
====================================================== */
export async function index(req, res) {
  const hospital = req.user.hospital;

  const total = await Transaction.countDocuments({ hospital });
  const success = await Transaction.countDocuments({ hospital, status: "success" });
  const fail = await Transaction.countDocuments({ hospital, status: "failed" });

  const revenue = await Transaction.aggregate([
    { $match: { hospital, status: "success" } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  res.json({
    totalTransactions: total,
    successful: success,
    failed: fail,
    revenue: revenue[0]?.total || 0,
  });
}

/* ======================================================
   LIST TRANSACTIONS
====================================================== */
export async function list(req, res) {
  const tx = await Transaction.find({ hospital: req.user.hospital })
    .sort({ createdAt: -1 })
    .populate("patient encounter");

  res.json(tx);
}

/* ======================================================
   GET SINGLE TRANSACTION
====================================================== */
export async function getOne(req, res) {
  const tx = await Transaction.findOne({
    _id: req.params.id,
    hospital: req.user.hospital,
  });

  if (!tx) return res.status(404).json({ error: "Not found" });
  res.json(tx);
}

/* ======================================================
   CONFIRM PAYMENT (WORKFLOW-ONLY)
====================================================== */
export async function markPaymentSuccess(req, res, next) {
  try {
    const { workflowId, transactionId } = req.body;

    if (!workflowId || !transactionId) {
      return res.status(400).json({
        msg: "workflowId and transactionId required",
      });
    }

    /**
     * 🚨 SINGLE SOURCE OF TRUTH
     */
    const wf = await workflowService.transition(
      "PAYMENT",
      workflowId,
      {
        transactionId,
        confirmedBy: req.user.id,
        hospital: req.user.hospital,
      }
    );

    /**
     * Effects guaranteed:
     * - Transaction success
     * - Receipt created
     * - Ledger entry
     * - Encounter PAID
     * - Report generated
     * - Audit logged
     */
    res.json({
      status: "payment_confirmed",
      transaction: wf.context.transaction,
      receipt: wf.context.receipt,
      encounter: wf.context.encounter,
    });
  } catch (err) {
    next(err);
  }
}

/* ======================================================
   GENERATE INVOICE PDF (READ-ONLY)
====================================================== */
export async function invoicePdf(req, res) {
  const tx = await Transaction.findOne({
    _id: req.params.id,
    hospital: req.user.hospital,
  }).populate("patient encounter");

  if (!tx) return res.status(404).send("Invoice not found");

  const doc = new PDFDocument({ size: "A4", margin: 50 });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=invoice_${tx.reference}.pdf`
  );

  doc.pipe(res);

  doc.fontSize(22).text("AfyaLink Medical Invoice", { align: "center" });
  doc.moveDown();

  doc.fontSize(12);
  doc.text(`Invoice Ref: ${tx.reference}`);
  doc.text(`Patient: ${tx.patient?.name || "N/A"}`);
  doc.text(`Encounter ID: ${tx.encounter?._id}`);
  doc.text(`Date: ${tx.createdAt.toDateString()}`);
  doc.moveDown();

  doc.fontSize(14).text("Payment Details", { underline: true });
  doc.moveDown(0.5);

  doc.fontSize(12).text(`Amount: ${tx.amount} ${tx.currency}`);
  doc.text(`Gateway: ${tx.gateway}`);
  doc.text(`Status: ${tx.status.toUpperCase()}`);

  doc.moveDown(2);
  doc.text("Thank you for choosing AfyaLink.", { align: "center" });

  doc.end();
}
