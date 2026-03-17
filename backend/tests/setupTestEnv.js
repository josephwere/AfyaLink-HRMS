import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer;
let usingExternalMongo = false;

function withTestDbName(uri, dbName) {
  const [base, query = ""] = uri.split("?");
  const idx = base.lastIndexOf("/");
  if (idx === -1) {
    return `${base}/${dbName}${query ? `?${query}` : ""}`;
  }
  const prefix = base.slice(0, idx + 1);
  return `${prefix}${dbName}${query ? `?${query}` : ""}`;
}

function extractDbName(uri) {
  const [base] = uri.split("?");
  const idx = base.lastIndexOf("/");
  if (idx === -1 || idx === base.length - 1) return "";
  return base.slice(idx + 1);
}

export default async function setup() {
  if (typeof jest !== "undefined" && typeof jest.setTimeout === "function") {
    jest.setTimeout(Number(process.env.TEST_TIMEOUT_MS || 30000));
  }
  const externalUri =
    process.env.TEST_MONGO_URI ||
    (process.env.USE_EXTERNAL_TEST_DB === "1" ? process.env.MONGO_URI : "");
  let uri = externalUri || "mongodb://127.0.0.1:27017/afyalink_test";
  const port = Number(process.env.TEST_MONGO_PORT || 0);
  let testDbName = "";
  if (externalUri) {
    usingExternalMongo = true;
    testDbName = process.env.TEST_DB_NAME || "afyalink_test";
    uri = withTestDbName(externalUri, testDbName);
  } else {
    try {
      mongoServer = await MongoMemoryServer.create({
        instance: { ip: "127.0.0.1", port },
      });
      uri = mongoServer.getUri();
    } catch (err) {
      if (!uri) throw err;
      usingExternalMongo = true;
    }
  }

  process.env.MONGO_URI = uri;
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret';
  await mongoose.connect(uri, { });
  if (usingExternalMongo) {
    const dbName = testDbName || extractDbName(uri);
    if (dbName && dbName.includes("_test")) {
      try {
        await mongoose.connection.dropDatabase();
      } catch (err) {
        try {
          const collections = await mongoose.connection.db.collections();
          for (const col of collections) {
            if (col.collectionName.startsWith("system.")) continue;
            await col.drop().catch(() => {});
          }
        } catch (_inner) {
          console.warn("⚠️ Unable to reset test database; collections may accumulate.");
        }
      }
    }
  }
  return async function teardown() {
    await mongoose.disconnect();
    if (!usingExternalMongo && mongoServer) {
      await mongoServer.stop();
    }
  };
}
