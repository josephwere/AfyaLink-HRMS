import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { jest as jestGlobals } from "@jest/globals";
import { createServer } from "node:net";

let mongoServer;
let usingExternalMongo = false;

// Set Jest timeout at module load so it applies to hooks that call `setup()`.
// Doing this inside `setup()` is too late to affect the current `beforeAll` timeout.
if (jestGlobals && typeof jestGlobals.setTimeout === "function") {
  const externalUriForTimeout =
    process.env.TEST_MONGO_URI ||
    (process.env.USE_EXTERNAL_TEST_DB === "1" ? process.env.MONGO_URI : "");
  const defaultTimeoutMs = externalUriForTimeout ? 30000 : 120000;
  jestGlobals.setTimeout(Number(process.env.TEST_TIMEOUT_MS || defaultTimeoutMs));
}

async function getFreeLocalPort(host = "127.0.0.1") {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, host, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      server.close(() => resolve(port));
    });
  });
}

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
  const externalUri =
    process.env.TEST_MONGO_URI ||
    (process.env.USE_EXTERNAL_TEST_DB === "1" ? process.env.MONGO_URI : "");
  let uri = externalUri || "mongodb://127.0.0.1:27017/afyalink_test";
  const requestedPort = Number(process.env.TEST_MONGO_PORT || 0);
  let testDbName = "";
  if (externalUri) {
    usingExternalMongo = true;
    testDbName = process.env.TEST_DB_NAME || "afyalink_test";
    uri = withTestDbName(externalUri, testDbName);
  } else {
    try {
      const port = requestedPort || (await getFreeLocalPort("127.0.0.1"));
      mongoServer = new MongoMemoryServer({
        instance: { ip: "127.0.0.1", port },
      });
      // mongodb-memory-server uses get-port internally (binds 0.0.0.0), which is blocked in some sandboxes.
      // Starting with forceSamePort avoids get-port entirely.
      await mongoServer.start(true);
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
