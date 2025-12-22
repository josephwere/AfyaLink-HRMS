import request from 'supertest';
import app from '../app.js';
import setup from './setupTestEnv.js';

let teardown;
let token;

beforeAll(async () => {
  teardown = await setup();
  await request(app).post('/api/auth/register').send({ name:'Doc', email:'doc@afya.test', password:'Doc123!', role:'Doctor' });
  const res = await request(app).post('/api/auth/login').send({ email:'doc@afya.test', password:'Doc123!' });
  token = res.body.token;
});

afterAll(async ()=>{ if (teardown) await teardown(); });

describe('Patients CRUD', ()=>{
  let patientId;
  test('create patient', async ()=>{
    const r = await request(app).post('/api/patients').set('Authorization', `Bearer ${token}`).send({ firstName:'John', lastName:'Doe', nationalId:'P123' });
    expect(r.status).toBe(200);
    expect(r.body._id).toBeDefined();
    patientId = r.body._id;
  });

  test('get patient', async ()=>{
    const r = await request(app).get(`/api/patients/${patientId}`).set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(200);
    expect(r.body._id).toBe(patientId);
  });
});
