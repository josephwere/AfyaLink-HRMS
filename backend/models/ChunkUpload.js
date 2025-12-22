import mongoose from 'mongoose';

const ChunkSchema = new mongoose.Schema({
  uploadId: { type: String, index: true },
  docId: String,
  total: Number,
  chunks: { type: Map, of: String }, // index -> base64 string
  completed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.ChunkUpload || mongoose.model('ChunkUpload', ChunkSchema);
