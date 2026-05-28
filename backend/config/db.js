import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/afyalink';

const parsePositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

mongoose.set("bufferCommands", false);

const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: parsePositiveInt(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS, 8000),
      connectTimeoutMS: parsePositiveInt(process.env.MONGO_CONNECT_TIMEOUT_MS, 10000),
      socketTimeoutMS: parsePositiveInt(process.env.MONGO_SOCKET_TIMEOUT_MS, 20000),
      heartbeatFrequencyMS: parsePositiveInt(process.env.MONGO_HEARTBEAT_FREQUENCY_MS, 10000),
      maxPoolSize: parsePositiveInt(process.env.MONGO_MAX_POOL_SIZE, 20),
      minPoolSize: parsePositiveInt(process.env.MONGO_MIN_POOL_SIZE, 0),
      autoIndex:
        process.env.MONGO_AUTO_INDEX === "1" ||
        (process.env.NODE_ENV !== "production" && process.env.MONGO_AUTO_INDEX !== "0"),
    });
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

export default connectDB;
