import request from 'supertest';
import app from '../app.js';
import setup from './setupTestEnv.js';

let teardown;
let token;
let patientId;

beforeAll(async ()=>{
  teardown = await setup();
  await request(app).post('/api/auth/register').send({ name:'Admin', email:'admin@afya.test', password:'Admin123!', role:'HospitalAdmin' });
  const res = await request(app).post('/api/auth/login').send({ email:'admin@afya.test', password:'Admin123!' });
  token = res.body.token;
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
