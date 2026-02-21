const workflowSchema = new Schema({
  patient: ObjectId,
  doctor: ObjectId,
  hospital: ObjectId,

  consultationId: ObjectId,
  labOrders: [ObjectId],
  pharmacyOrders: [ObjectId],
  billId: ObjectId,

  state: {
    type: String,
    enum: [
      "CONSULTATION",
      "LAB",
      "PHARMACY",
      "BILLING",
      "PAID",
      "CLOSED"
    ],
    default: "CONSULTATION"
  }
}, { timestamps: true });
