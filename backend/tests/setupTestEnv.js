import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer;

export default async function setup() {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.MONGO_URI = uri;
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret';
  await mongoose.connect(uri, { });
  return async function teardown() {
    await mongoose.disconnect();
    await mongoServer.stop();
  };
}
