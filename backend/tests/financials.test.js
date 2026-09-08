import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import setup from './setupTestEnv.js';
import User from '../models/User.js';
import Hospital from '../models/Hospital.js';
import ChartOfAccount from '../models/ChartOfAccount.js';
import AccountingPeriod from '../models/AccountingPeriod.js';

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
  patientId = p.body.patient?._id;
  expect(patientId).toBeDefined();
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
    expect(r.body.status).toBe('Paid');
  });

  test('cashier finance endpoints expose invoice and payment flows', async ()=>{
    const invoiceList = await request(app).get('/api/finance/invoices').set('Authorization', `Bearer ${token}`);
    expect(invoiceList.status).toBe(200);
    expect(Array.isArray(invoiceList.body.items) || Array.isArray(invoiceList.body.invoices)).toBe(true);

    const paymentRes = await request(app)
      .post('/api/finance/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ invoiceId, amount: 25, method: 'CASH', reference: 'cashier-flow-check' });

    expect(paymentRes.status).toBe(200);
    expect(paymentRes.body).toBeTruthy();

    const receiptList = await request(app).get('/api/finance/receipts').set('Authorization', `Bearer ${token}`);
    expect(receiptList.status).toBe(200);
    expect(Array.isArray(receiptList.body.items) || Array.isArray(receiptList.body.receipts)).toBe(true);
  });

  test('accountant finance endpoints expose accounting data', async ()=>{
    const accountant = await User.create({
      name: 'Accountant',
      email: 'accountant@afya.test',
      password: 'Admin123!',
      role: 'ACCOUNTANT',
      hospital: (await Hospital.findOne({ name: 'Test Hospital Financials' }))._id,
      active: true,
    });
    const accountantToken = jwt.sign(
      { id: String(accountant._id), twoFactorVerified: true },
      process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
    );

    await ChartOfAccount.deleteMany({});
    await AccountingPeriod.deleteMany({});
    await ChartOfAccount.create([
      { code: '1000', name: 'Cash', category: 'ASSET', normalBalance: 'DEBIT', status: 'ACTIVE' },
      { code: '1100', name: 'Accounts Receivable', category: 'ASSET', normalBalance: 'DEBIT', status: 'ACTIVE' },
      { code: '4000', name: 'Revenue', category: 'REVENUE', normalBalance: 'CREDIT', status: 'ACTIVE' },
    ]);
    await AccountingPeriod.create({
      periodKey: '2026-08',
      label: 'August 2026',
      startDate: new Date('2026-08-01'),
      endDate: new Date('2026-08-31'),
      status: 'OPEN',
    });

    const periodRes = await request(app).get('/api/finance/periods').set('Authorization', `Bearer ${accountantToken}`);
    expect(periodRes.status).toBe(200);
    expect(Array.isArray(periodRes.body.items) || Array.isArray(periodRes.body.periods)).toBe(true);

    const chartRes = await request(app).get('/api/finance/chart-of-accounts').set('Authorization', `Bearer ${accountantToken}`);
    expect(chartRes.status).toBe(200);
    expect(Array.isArray(chartRes.body.items) || Array.isArray(chartRes.body.accounts)).toBe(true);

    const ledgerRes = await request(app).get('/api/finance/general-ledger').set('Authorization', `Bearer ${accountantToken}`);
    expect(ledgerRes.status).toBe(200);
    expect(Array.isArray(ledgerRes.body.items) || Array.isArray(ledgerRes.body.entries)).toBe(true);

    const journalRes = await request(app).get('/api/finance/journal-entries').set('Authorization', `Bearer ${accountantToken}`);
    expect(journalRes.status).toBe(200);
    expect(Array.isArray(journalRes.body.items) || Array.isArray(journalRes.body.entries)).toBe(true);

    const reconciliationRes = await request(app).get('/api/finance/reconciliation').set('Authorization', `Bearer ${accountantToken}`);
    expect(reconciliationRes.status).toBe(200);
    expect(reconciliationRes.body).toBeTruthy();
  });
});
