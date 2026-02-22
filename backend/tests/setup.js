import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongo;
export default async function setup(){
  const port = Number(process.env.TEST_MONGO_PORT || 37017);
  mongo = await MongoMemoryServer.create({
    instance: { ip: "127.0.0.1", port },
  });
  const uri = mongo.getUri();
  await mongoose.connect(uri);
  return async ()=>{ await mongoose.disconnect(); await mongo.stop(); }
}
