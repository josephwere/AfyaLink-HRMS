import mongoose from 'mongoose';
import { incrementMetricCounter, setMetricGauge } from "../utils/metrics.js";
import "./loadEnv.js";

const DEFAULT_LOCAL_MONGO_URI = 'mongodb://127.0.0.1:27017/afyalink';
const MONGO_URI = process.env.MONGO_URI || DEFAULT_LOCAL_MONGO_URI;

export function shouldUseMemoryMongo() {
  const explicitFlag = String(process.env.USE_MEMORY_MONGO || "").trim().toLowerCase();
  const nodeEnv = String(process.env.NODE_ENV || "development").toLowerCase();
  const mongoUri = String(process.env.MONGO_URI || "").trim();
  const isDefaultLocalUri = !mongoUri || mongoUri === DEFAULT_LOCAL_MONGO_URI;
  return (nodeEnv === "test" || explicitFlag === "true" || explicitFlag === "1") && isDefaultLocalUri;
}

const parsePositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

mongoose.set("bufferCommands", false);

let metricsBound = false;

function bindMongoMetrics() {
  if (metricsBound) return;
  metricsBound = true;

  setMetricGauge(
    "afyalink_db_connection_ready",
    mongoose.connection?.readyState === 1 ? 1 : 0,
    {},
    "Whether MongoDB is currently connected and ready."
  );

  mongoose.connection.on("connected", () => {
    setMetricGauge("afyalink_db_connection_ready", 1);
    incrementMetricCounter(
      "afyalink_db_connection_events_total",
      { event: "connected" },
      1,
      "MongoDB connection lifecycle events."
    );
  });

  mongoose.connection.on("disconnected", () => {
    setMetricGauge("afyalink_db_connection_ready", 0);
    incrementMetricCounter("afyalink_db_connection_events_total", { event: "disconnected" });
  });

  mongoose.connection.on("reconnected", () => {
    setMetricGauge("afyalink_db_connection_ready", 1);
    incrementMetricCounter("afyalink_db_connection_events_total", { event: "reconnected" });
  });

  mongoose.connection.on("error", () => {
    setMetricGauge("afyalink_db_connection_ready", 0);
    incrementMetricCounter(
      "afyalink_db_connection_errors_total",
      { phase: "runtime" },
      1,
      "MongoDB connection errors observed by the application."
    );
  });
}

const connectDB = async () => {
  try {
    bindMongoMetrics();
    if (shouldUseMemoryMongo()) {
      const { MongoMemoryServer } = await import("mongodb-memory-server");
      const memoryServer = await MongoMemoryServer.create({
        instance: { ip: "127.0.0.1", port: 27017 },
      });
      process.env.MONGO_URI = memoryServer.getUri();
      console.log("[DB] using in-memory MongoDB for local development");
    }
    await mongoose.connect(process.env.MONGO_URI || MONGO_URI, {
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
    setMetricGauge("afyalink_db_connection_ready", 1);
  } catch (err) {
    console.error('MongoDB connection error:', err);
    setMetricGauge("afyalink_db_connection_ready", 0);
    incrementMetricCounter(
      "afyalink_db_connection_errors_total",
      { phase: "initial" },
      1,
      "MongoDB connection errors observed by the application."
    );
    process.exit(1);
  }
};

export default connectDB;
