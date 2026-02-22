import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer;
let usingExternalMongo = false;

export default async function setup() {
  let uri =
    process.env.TEST_MONGO_URI ||
    process.env.MONGO_URI ||
    "mongodb://127.0.0.1:27017/afyalink_test";
  const port = Number(process.env.TEST_MONGO_PORT || 37017);
  try {
    mongoServer = await MongoMemoryServer.create({
      instance: { ip: "127.0.0.1", port },
    });
    uri = mongoServer.getUri();
  } catch (err) {
    if (!uri) throw err;
    usingExternalMongo = true;
  }

  process.env.MONGO_URI = uri;
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret';
  await mongoose.connect(uri, { });
  return async function teardown() {
    await mongoose.disconnect();
    if (!usingExternalMongo && mongoServer) {
      await mongoServer.stop();
    }
  };
}
