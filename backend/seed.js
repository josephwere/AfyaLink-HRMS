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
  const h = await Hospital.create({name:'AfyaLink Demo Medical Center', code:'AFYA-DEMO-001', address:'Demo Road, Nairobi', contact:'+254700000000'});
  const sharedPassword = 'AfyaDemo@2026!';
  const superAdmin = await User.create({name:'Super Admin', email:'super@afya.demo', password:sharedPassword, role:'SUPER_ADMIN'});
  const hospitalAdmin = await User.create({name:'Mary Wanjiku Hospital Admin', email:'hospital.admin@afyalink.demo', password:sharedPassword, role:'HOSPITAL_ADMIN', hospital: h._id});
  const adminAssistant = await User.create({name:'Peter Kariuki Admin Assistant', email:'hospital.admin.assistant@afyalink.demo', password:sharedPassword, role:'HOSPITAL_ADMIN_ASSISTANT', hospital: h._id});
  const doc = await User.create({name:'Dr Amina Otieno', email:'doctor@afyalink.demo', password:sharedPassword, role:'DOCTOR', hospital: h._id});
  const surgeon = await User.create({name:'Dr Brian Mwangi', email:'surgeon@afyalink.demo', password:sharedPassword, role:'SURGEON', hospital: h._id});
  const nurse = await User.create({name:'Grace Njeri Nurse', email:'nurse@afyalink.demo', password:sharedPassword, role:'NURSE', hospital: h._id});
  const labTech = await User.create({name:'Kevin Ochieng Lab Tech', email:'lab.tech@afyalink.demo', password:sharedPassword, role:'LAB_TECH', hospital: h._id});
  const pharmacist = await User.create({name:'Faith Wambui Pharmacist', email:'pharmacist@afyalink.demo', password:sharedPassword, role:'PHARMACIST', hospital: h._id});
  const radiologist = await User.create({name:'Dr Sarah Chebet Radiologist', email:'radiologist@afyalink.demo', password:sharedPassword, role:'RADIOLOGIST', hospital: h._id});
  const therapist = await User.create({name:'Lucy Achieng Therapist', email:'therapist@afyalink.demo', password:sharedPassword, role:'THERAPIST', hospital: h._id});
  const receptionist = await User.create({name:'Janet Moraa Receptionist', email:'receptionist@afyalink.demo', password:sharedPassword, role:'RECEPTIONIST', hospital: h._id});
  const securityOfficer = await User.create({name:'Samuel Kiptoo Security Officer', email:'security.officer@afyalink.demo', password:sharedPassword, role:'SECURITY_OFFICER', hospital: h._id});
  const securityAdmin = await User.create({name:'Victor Onyango Security Admin', email:'security.admin@afyalink.demo', password:sharedPassword, role:'SECURITY_ADMIN', hospital: h._id});
  const hrManager = await User.create({name:'Eunice Muthoni HR Manager', email:'hr.manager@afyalink.demo', password:sharedPassword, role:'HR_MANAGER', hospital: h._id});
  const payrollOfficer = await User.create({name:'Daniel Kimani Payroll Officer', email:'payroll.officer@afyalink.demo', password:sharedPassword, role:'PAYROLL_OFFICER', hospital: h._id});
  const communityHealth = await User.create({name:'Mercy Atieno Community Health Worker', email:'community.health.worker@afyalink.demo', password:sharedPassword, role:'COMMUNITY_HEALTH_WORKER', hospital: h._id});
  const govtAdmin = await User.create({name:'Agnes Moraa Government Admin', email:'government.admin@afyalink.demo', password:sharedPassword, role:'GOVERNMENT_ADMIN'});
  const govtReg = await User.create({name:'Isaac Koech Regulator', email:'government.regulator@afyalink.demo', password:sharedPassword, role:'GOVERNMENT_REGULATOR'});
  const govtAuditor = await User.create({name:'Beatrice Nyambura Auditor', email:'government.auditor@afyalink.demo', password:sharedPassword, role:'GOVERNMENT_AUDITOR'});
  const govtInspector = await User.create({name:'Patrick Langat Inspector', email:'government.inspector@afyalink.demo', password:sharedPassword, role:'GOVERNMENT_INSPECTOR'});
  const govtAnalyst = await User.create({name:'Naomi Akinyi Analyst', email:'government.analyst@afyalink.demo', password:sharedPassword, role:'GOVERNMENT_ANALYST'});
  const patientUser = await User.create({name:'John Barasa Patient', email:'patient.demo@afyalink.demo', password:sharedPassword, role:'PATIENT', hospital: h._id});
  // Finance roles
  const accountant = await User.create({name:'Demo Accountant', email:'accountant@afyalink.demo', password:sharedPassword, role:'ACCOUNTANT', hospital: h._id});
  const financeManager = await User.create({name:'Demo Finance Manager', email:'finance.manager@afyalink.demo', password:sharedPassword, role:'FINANCE_MANAGER', hospital: h._id});
  const cfo = await User.create({name:'Demo CFO', email:'cfo@afyalink.demo', password:sharedPassword, role:'CFO', hospital: h._id});
  const patient = await Patient.create({firstName:'John', lastName:'Doe', dob:new Date('1980-01-01'), nationalId:'P123456', countryId:'NHIF-0001', hospital: h._id, primaryDoctor: doc._id});
  console.log('Seeded demo hospital and users');
  process.exit(0);
};

run().catch(e=>{console.error(e); process.exit(1);});
