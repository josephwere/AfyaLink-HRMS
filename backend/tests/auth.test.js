import request from 'supertest';
import app from '../app.js';
import setup from './setupTestEnv.js';

let teardown;
beforeAll(async () => { teardown = await setup(); });
afterAll(async () => { if (teardown) await teardown(); });

describe('Auth (register/login)', ()=>{
  test('register -> login flow', async ()=>{
    const reg = await request(app).post('/api/auth/register').send({ name:'Test User', email:'test@afya.test', password:'Pass123!', role:'Doctor' });
    expect([200, 201]).toContain(reg.status);
    expect(reg.body.success).toBe(true);

    const login = await request(app).post('/api/auth/login').send({ email:'test@afya.test', password:'Pass123!' });
    expect(login.status).toBe(200);
    expect(login.body.accessToken || login.body.token).toBeDefined();
  });
});
