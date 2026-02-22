import mongoose from "mongoose";

const MachineDeviceSchema = new mongoose.Schema(
  {
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true },
    department: { type: String, default: "", trim: true },
    machineType: {
      type: String,
      enum: ["LAB_ANALYZER", "PACS", "VITAL_MONITOR", "PHARMACY_DISPENSER", "OTHER"],
      default: "OTHER",
    },
    protocol: {
      type: String,
      enum: ["HL7", "FHIR", "DICOM", "ASTM", "REST", "CUSTOM"],
      default: "REST",
      index: true,
    },
    status: {
      type: String,
      enum: ["ONLINE", "OFFLINE", "ERROR", "MAINTENANCE"],
      default: "OFFLINE",
      index: true,
    },
    apiKeyHash: { type: String, required: true, select: false },
    lastHeartbeatAt: { type: Date, default: null, index: true },
    lastOfflineAlertAt: { type: Date, default: null },
    lastSeenIp: { type: String, default: "" },
    metadata: { type: Object, default: {} },
    capabilities: {
      ingestLabResults: { type: Boolean, default: false },
      ingestVitals: { type: Boolean, default: false },
      ingestImaging: { type: Boolean, default: false },
      pushAlerts: { type: Boolean, default: false },
    },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

MachineDeviceSchema.index({ hospital: 1, code: 1 }, { unique: true });
MachineDeviceSchema.index({ hospital: 1, name: 1 });

export default mongoose.models.MachineDevice ||
  mongoose.model("MachineDevice", MachineDeviceSchema);
