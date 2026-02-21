import request from 'supertest';
import app from '../app.js';
import setup from './setupTestEnv.js';

let teardown;
let token;
let patientId;

beforeAll(async ()=>{
  teardown = await setup();
  await request(app).post('/api/auth/register').send({ name:'Doc', email:'doc2@afya.test', password:'Doc123!', role:'Doctor' });
  const res = await request(app).post('/api/auth/login').send({ email:'doc2@afya.test', password:'Doc123!' });
  token = res.body.token;
  const p = await request(app).post('/api/patients').set('Authorization', `Bearer ${token}`).send({ firstName:'Amy', lastName:'Smith' });
  patientId = p.body._id;
});

afterAll(async ()=>{ if (teardown) await teardown(); });

describe('Appointments', ()=>{
  let apptId;
  test('create appointment', async ()=>{
    const r = await request(app).post('/api/appointments').set('Authorization', `Bearer ${token}`).send({ patient: patientId, scheduledAt: new Date().toISOString(), doctor: null });
    expect(r.status).toBe(200);
    expect(r.body._id).toBeDefined();
    apptId = r.body._id;
  });

  test('list appointments', async ()=>{
    const r = await request(app).get('/api/appointments').set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);
  });
});
