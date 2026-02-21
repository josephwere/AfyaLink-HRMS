import mongoose from "mongoose";

const { Schema } = mongoose;

const OfflineModuleMetricSchema = new Schema(
  {
    module: { type: String, required: true },
    pending: { type: Number, default: 0 },
    retryFailures: { type: Number, default: 0 },
  },
  { _id: false }
);

const OfflineClientMetricSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", index: true, required: true },
    hospital: { type: Schema.Types.ObjectId, ref: "Hospital", index: true },
    role: { type: String, index: true },
    deviceId: { type: String, required: true, index: true },
    online: { type: Boolean, default: true },
    queueLength: { type: Number, default: 0 },
    queuedTotal: { type: Number, default: 0 },
    syncedTotal: { type: Number, default: 0 },
    failedTotal: { type: Number, default: 0 },
    lastEnqueueAt: { type: Date, default: null },
    lastSyncAt: { type: Date, default: null },
    lastFailureAt: { type: Date, default: null },
    modules: { type: [OfflineModuleMetricSchema], default: [] },
    clientUpdatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

OfflineClientMetricSchema.index({ user: 1, deviceId: 1 }, { unique: true });
OfflineClientMetricSchema.index({ hospital: 1, clientUpdatedAt: -1 });
OfflineClientMetricSchema.index({ clientUpdatedAt: -1 });

export default mongoose.models.OfflineClientMetric ||
  mongoose.model("OfflineClientMetric", OfflineClientMetricSchema);

