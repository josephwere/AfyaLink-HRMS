import request from 'supertest';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import setup from './setupTestEnv.js';
import User from '../models/User.js';
import { getOtp } from '../services/otpStore.js';

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

  test('legacy user without userId gets assigned one during login', async () => {
    const password = 'LegacyPass123!';
    const hashed = await bcrypt.hash(password, 10);
    const insertResult = await User.collection.insertOne({
      name: 'Legacy User',
      email: 'legacy@afya.test',
      password: hashed,
      role: 'DOCTOR',
      authProvider: 'local',
      authMethods: ['local'],
      active: true,
      emailVerified: true,
    });

    expect(insertResult.insertedId).toBeTruthy();

    const login = await request(app).post('/api/auth/login').send({ email:'legacy@afya.test', password });
    expect(login.status).toBe(200);
    expect(login.body.success).toBe(true);
    expect(login.body.user?.userId).toBeTruthy();

    const user = await User.findById(insertResult.insertedId).select('userId');
    expect(user.userId).toBeTruthy();
  });

  test('forgot password email reset stores a usable password', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Reset User', email: 'reset@afya.test', password: 'Pass123!' });

    const forgot = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'reset@afya.test' });

    expect(forgot.status).toBe(200);

    const user = await User.findOne({ email: 'reset@afya.test' }).select(
      '+resetPasswordToken +resetPasswordExpires +password'
    );
    expect(user.resetPasswordToken).toBeTruthy();
    expect(user.resetPasswordExpires).toBeTruthy();

    const rawToken = 'integration-test-token';
    user.resetPasswordToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    user.resetPasswordExpires = new Date(Date.now() + 60 * 1000);
    await user.save();

    const reset = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: rawToken, password: 'NewPass123!' });

    expect(reset.status).toBe(200);
    expect(reset.body.success).toBe(true);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'reset@afya.test', password: 'NewPass123!' });

    expect(login.status).toBe(200);
    expect(login.body.success).toBe(true);
  });

  test('phone reset otp flow resets password for phone-based recovery', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Phone Reset User', email: 'phone-reset@afya.test', phone: '+254700000111', password: 'Pass123!' });

    const otpRequest = await request(app)
      .post('/api/auth/forgot-password/phone/request-otp')
      .send({ phone: '+254700000111' });

    expect(otpRequest.status).toBe(200);

    const user = await User.findOne({ phone: '+254700000111' });
    const otp = await getOtp(`password-reset:${user._id}`);
    expect(otp).toBeTruthy();

    const reset = await request(app)
      .post('/api/auth/reset-password/phone')
      .send({ phone: '+254700000111', otp, password: 'PhonePass123!' });

    expect(reset.status).toBe(200);
    expect(reset.body.success).toBe(true);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ phone: '+254700000111', password: 'PhonePass123!' });

    expect(login.status).toBe(200);
    expect(login.body.success).toBe(true);
  });

  test('google-created accounts can request reset and then login with a password', async () => {
    await User.create({
      name: 'Google Reset User',
      email: 'google-reset@afya.test',
      authProvider: 'google',
      googleId: 'google-reset-user-id',
      emailVerified: true,
      role: 'PATIENT',
    });

    const forgot = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'google-reset@afya.test' });

    expect(forgot.status).toBe(200);

    const user = await User.findOne({ email: 'google-reset@afya.test' }).select(
      '+resetPasswordToken +resetPasswordExpires +password'
    );
    expect(user.resetPasswordToken).toBeTruthy();
    expect(user.password).toBeFalsy();

    const rawToken = 'google-reset-token';
    user.resetPasswordToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    user.resetPasswordExpires = new Date(Date.now() + 60 * 1000);
    await user.save();

    const reset = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: rawToken, password: 'GooglePass123!' });

    expect(reset.status).toBe(200);
    expect(reset.body.success).toBe(true);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'google-reset@afya.test', password: 'GooglePass123!' });

    expect(login.status).toBe(200);
    expect(login.body.success).toBe(true);
  });
});
