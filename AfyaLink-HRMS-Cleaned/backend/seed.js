/**
 * Seed script - creates sample users, patients, and appointments.
 * Run: node seed.js (ensure MONGO_URI in env or defaults to localhost)
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Patient = require('./models/Patient');
const Appointment = require('./models/Appointment');

const MONGO = process.env.MONGO_URI || 'mongodb://localhost:27017/afyalink-demo';

async function seed(){
  await mongoose.connect(MONGO);
  console.log('Connected to DB');
  await User.deleteMany({});
  await Patient.deleteMany({});
  await Appointment.deleteMany({});

  const users = [
    { name: 'Admin User', email: 'admin@afya.test', password: await bcrypt.hash('adminpass',10), role: 'admin' },
    { name: 'Dr. Asha', email: 'dr.asha@afya.test', password: await bcrypt.hash('docpass',10), role: 'doctor' },
    { name: 'Nurse John', email: 'nurse.john@afya.test', password: await bcrypt.hash('nursepass',10), role: 'nurse' },
    { name: 'Patient Mary', email: 'mary@afya.test', password: await bcrypt.hash('patientpass',10), role: 'patient' }
  ];
  const createdUsers = await User.insertMany(users);
  console.log('Users created');

  const patients = [
    { firstName: 'Mary', lastName: 'Wanjiru', dob: new Date(1990,1,1), gender: 'female', contact: '0700000000', address: 'Nairobi', medicalHistory: ['hypertension'] },
    { firstName: 'James', lastName: 'Otieno', dob: new Date(1985,5,20), gender: 'male', contact: '0711111111', address: 'Kisumu', medicalHistory: [] }
  ];
  const createdPatients = await Patient.insertMany(patients);
  console.log('Patients created');

  const appts = [
    { patientId: createdPatients[0]._id, doctorId: createdUsers[1]._id, date: new Date(Date.now()+86400000), reason: 'Follow-up' },
    { patientId: createdPatients[1]._id, doctorId: createdUsers[1]._id, date: new Date(Date.now()+172800000), reason: 'New complaint' }
  ];
  await Appointment.insertMany(appts);
  console.log('Appointments created');

  mongoose.connection.close();
  console.log('Done');
}

seed().catch(err => { console.error(err); process.exit(1); });
