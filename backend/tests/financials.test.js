import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import setup from './setupTestEnv.js';
import User from '../models/User.js';
import Hospital from '../models/Hospital.js';

let teardown;
let token;
let patientId;

beforeAll(async ()=>{
  teardown = await setup();
  const hospital = await Hospital.create({ name: "Test Hospital Financials", active: true });
  const user = await User.create({
    name: "Admin",
    email: "admin@afya.test",
    password: "Admin123!",
    role: "HOSPITAL_ADMIN",
    hospital: hospital._id,
    active: true,
  });
  token = jwt.sign(
    { id: String(user._id), twoFactorVerified: true },
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
  );
  const p = await request(app).post('/api/patients').set('Authorization', `Bearer ${token}`).send({ firstName:'Bill', lastName:'Payer' });
  patientId = p.body._id;
});

afterAll(async ()=>{ if (teardown) await teardown(); });

describe('Financials', ()=>{
  let invoiceId;
  test('create invoice', async ()=>{
    const r = await request(app).post('/api/financials/invoice').set('Authorization', `Bearer ${token}`).send({ patient: patientId, items:[{description:'Consult', amount:100}] });
    expect(r.status).toBe(200);
    expect(r.body.invoiceNumber).toBeDefined();
    invoiceId = r.body._id;
  });

  test('record payment', async ()=>{
    const r = await request(app).post(`/api/financials/${invoiceId}/pay`).set('Authorization', `Bearer ${token}`).send({ amount:100, method:'Card' });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('Paid' || 'Paid' );
  });
});
