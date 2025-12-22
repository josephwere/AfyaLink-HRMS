import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import Hospital from './models/Hospital.js';
import User from './models/User.js';
import Patient from './models/Patient.js';
dotenv.config();

const run = async ()=>{
  await connectDB();
  console.log('Seeding...');
  await Hospital.deleteMany({});
  await User.deleteMany({});
  await Patient.deleteMany({});
  const h = await Hospital.create({name:'Demo Hospital', code:'DEMO-001', address:'123 Health St', contact:'+254700000000'});
  const superAdmin = await User.create({name:'Super Admin', email:'super@afya.test', password:'password', role:'SuperAdmin'});
  const admin = await User.create({name:'Hospital Admin', email:'admin@demo.test', password:'password', role:'HospitalAdmin', hospital: h._id});
  const doc = await User.create({name:'Dr. Alice', email:'alice@demo.test', password:'password', role:'Doctor', hospital: h._id});
  const nurse = await User.create({name:'Nurse Bob', email:'bob@demo.test', password:'password', role:'Nurse', hospital: h._id});
  const patient = await Patient.create({firstName:'John', lastName:'Doe', dob:new Date('1980-01-01'), nationalId:'P123456', countryId:'NHIF-0001', hospital: h._id, primaryDoctor: doc._id});
  console.log('Seeded:', {h, superAdmin, admin, doc, nurse, patient});
  process.exit(0);
};

run().catch(e=>{console.error(e); process.exit(1);});
