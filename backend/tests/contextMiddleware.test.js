import express from 'express';
import request from 'supertest';
import app from '../app.js';
import setup from './setupTestEnv.js';
import { enforceApplicationContext, requireContext } from '../middleware/applicationContext.js';
import { authorize } from '../middleware/authorize.js';

let teardown;
beforeAll(async () => {
  teardown = await setup();
});

afterAll(async () => {
  if (teardown) await teardown();
});

describe('application context enforcement', () => {
  test('route-level guard rejects a mismatched context', async () => {
    const guardedApp = express();
    guardedApp.use((req, _res, next) => {
      req.user = { role: 'DOCTOR', allowedContexts: ['WORK', 'MY_HEALTH'] };
      req.context = 'WORK';
      next();
    });
    guardedApp.get('/guarded', requireContext('MY_HEALTH'), (_req, res) => {
      res.json({ ok: true });
    });

    const response = await request(guardedApp).get('/guarded');

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('WRONG_CONTEXT');
  });

  test('declarative authorization rejects contexts that are not allowed for the account', async () => {
    const guardedApp = express();
    guardedApp.use((req, _res, next) => {
      req.user = { role: 'DOCTOR', allowedContexts: ['WORK'], hospital: 'hospital-1' };
      req.context = { mode: 'WORK', allowedContexts: ['WORK'] };
      next();
    });
    guardedApp.get('/guarded', authorize({ context: 'MY_HEALTH', permissions: [{ resource: 'appointments', action: 'read' }], resource: 'appointments' }), (_req, res) => {
      res.json({ ok: true });
    });

    const response = await request(guardedApp).get('/guarded');

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('CONTEXT_NOT_ALLOWED');
  });

  test('declarative authorization denies a user without the required profile permission', async () => {
    const guardedApp = express();
    guardedApp.use((req, _res, next) => {
      req.user = { role: 'PATIENT', allowedContexts: ['MY_HEALTH'], hospital: 'hospital-1' };
      req.context = { mode: 'MY_HEALTH', allowedContexts: ['MY_HEALTH'] };
      next();
    });
    guardedApp.get('/guarded', authorize({ context: 'MY_HEALTH', permissions: [{ resource: 'profiles', action: 'update' }], resource: 'profiles' }), (_req, res) => {
      res.json({ ok: true });
    });

    const response = await request(guardedApp).get('/guarded');

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('PERMISSION_DENIED');
  });

  test('defaults patients to My Health when no header is supplied', async () => {
    const guardedApp = express();
    guardedApp.use((req, _res, next) => {
      req.user = { role: 'PATIENT', allowedContexts: ['MY_HEALTH'] };
      next();
    });
    guardedApp.use(enforceApplicationContext);
    guardedApp.get('/guarded', requireContext('MY_HEALTH'), (_req, res) => {
      res.json({ ok: true, context: _req.context });
    });

    const response = await request(guardedApp).get('/guarded');

    expect(response.status).toBe(200);
    expect(response.body.context?.mode).toBe('MY_HEALTH');
  });

  test('rejects invalid context values', async () => {
    const guardedApp = express();
    guardedApp.use((req, _res, next) => {
      req.user = { role: 'DOCTOR', hospital: 'hospital-1', allowedContexts: ['WORK', 'MY_HEALTH'] };
      next();
    });
    guardedApp.use(enforceApplicationContext);
    guardedApp.get('/guarded', (_req, res) => {
      res.json({ ok: true });
    });

    const response = await request(guardedApp).get('/guarded').set('X-AfyaLink-Context', 'invalid');

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_CONTEXT');
  });

  test('rejects My Health context for service-style accounts', async () => {
    const email = 'context-service@afya.test';
    const password = 'Pass123!';

    const register = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Service Context User',
        email,
        password,
        role: 'Patient',
        accountType: 'service',
      });

    expect([200, 201]).toContain(register.status);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email, password });

    expect(login.status).toBe(200);
    const token = login.body.accessToken || login.body.token;
    expect(token).toBeTruthy();

    const profile = await request(app)
      .get('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .set('X-AfyaLink-Context', 'MY_HEALTH');

    expect(profile.status).toBe(403);
    expect(profile.body.code).toBe('CONTEXT_NOT_ALLOWED');
  });

  test('allows patient accounts to use My Health context on profile routes', async () => {
    const email = 'context-patient@afya.test';
    const password = 'Pass123!';

    const register = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Patient Context User',
        email,
        password,
        role: 'Patient',
      });

    expect([200, 201]).toContain(register.status);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email, password });

    expect(login.status).toBe(200);
    const token = login.body.accessToken || login.body.token;
    expect(token).toBeTruthy();

    const profile = await request(app)
      .get('/api/profile')
      .set('Authorization', `Bearer ${token}`)
      .set('X-AfyaLink-Context', 'MY_HEALTH');

    expect(profile.status).toBe(200);
    expect(profile.body.user?.email || profile.body.email).toBe(email);
  });
});
