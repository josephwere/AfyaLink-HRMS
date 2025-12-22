import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongo;
export default async function setup(){
  mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri();
  await mongoose.connect(uri);
  return async ()=>{ await mongoose.disconnect(); await mongo.stop(); }
}
