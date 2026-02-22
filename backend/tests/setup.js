import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongo;
let usingExternalMongo = false;
export default async function setup(){
  let uri =
    process.env.TEST_MONGO_URI ||
    process.env.MONGO_URI ||
    "mongodb://127.0.0.1:27017/afyalink_test";
  const port = Number(process.env.TEST_MONGO_PORT || 37017);
  try {
    mongo = await MongoMemoryServer.create({
      instance: { ip: "127.0.0.1", port },
    });
    uri = mongo.getUri();
  } catch (err) {
    if (!uri) throw err;
    usingExternalMongo = true;
  }

  await mongoose.connect(uri);
  return async ()=>{
    await mongoose.disconnect();
    if (!usingExternalMongo && mongo) await mongo.stop();
  }
}
