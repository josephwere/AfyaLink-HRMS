import Stripe from 'stripe';
import fetch from 'node-fetch';
import Transaction from '../models/Transaction.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2022-11-15' });

export async function createStripeIntent(req, res) {
  const { amount, currency = 'usd', metadata = {} } = req.body;
  try {
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(amount),
      currency,
      metadata
    });
    await Transaction.create({ provider: 'stripe', reference: intent.id, amount, currency, status: 'pending', meta: metadata });
    res.json({ clientSecret: intent.client_secret });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

export async function handleStripeWebhook(req, res) {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
  let event;
  try {
    if (endpointSecret) {
      event = stripe.webhooks.constructEvent(req.rawBody || req.body, sig, endpointSecret);
    } else {
      event = req.body;
    }
    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object;
      await Transaction.findOneAndUpdate({ reference: intent.id }, { status: 'succeeded', meta: intent });
    }
    res.json({ received: true });
  } catch (err) {
    console.error('webhook error', err);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
}

export async function mpesaSTKPush(req, res) {
  const { amount, phone, accountRef = 'AfyaLink' } = req.body;
  try {
    const authResp = await fetch('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
      headers: { Authorization: 'Basic ' + Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString('base64') }
    });
    const auth = await authResp.json();
    const token = auth.access_token;
    const timestamp = new Date().toISOString().replace(/[^0-9]/g,'').slice(0,14);
    const pass = Buffer.from(`${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${timestamp}`).toString('base64');
    const body = {
      BusinessShortCode: process.env.MPESA_SHORTCODE,
      Password: pass,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phone,
      PartyB: process.env.MPESA_SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: process.env.MPESA_CALLBACK_URL,
      AccountReference: accountRef,
      TransactionDesc: 'AfyaLink Payment'
    };
    const r = await fetch('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const j = await r.json();
    await Transaction.create({ provider: 'mpesa', reference: j.CheckoutRequestID || 'mpesa-'+Date.now(), amount, status:'pending', meta: j });
    res.json(j);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

export async function flutterwaveInit(req, res) {
  const { amount, currency = 'KES', customer = {} } = req.body;
  const fwKey = process.env.FLUTTERWAVE_SECRET;
  try {
    const r = await fetch('https://api.flutterwave.com/v3/payments', {
      method:'POST',
      headers:{ Authorization: `Bearer ${fwKey}`, 'Content-Type':'application/json' },
      body: JSON.stringify({
        tx_ref: 'afyalink_'+Date.now(),
        amount,
        currency,
        redirect_url: process.env.FLUTTERWAVE_REDIRECT,
        customer
      })
    });
    const j = await r.json();
    await Transaction.create({ provider: 'flutterwave', reference: j.data?.id || j.data?.link, amount, status: 'pending', meta: j });
    res.json(j);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
