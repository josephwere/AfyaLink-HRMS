import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer;

export default async function setup() {
  const port = Number(process.env.TEST_MONGO_PORT || 37017);
  mongoServer = await MongoMemoryServer.create({
    instance: { ip: "127.0.0.1", port },
  });
  const uri = mongoServer.getUri();
  process.env.MONGO_URI = uri;
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret';
  await mongoose.connect(uri, { });
  return async function teardown() {
    await mongoose.disconnect();
    await mongoServer.stop();
  };
}
