import React from 'react';
import { apiFetch } from '../../services/api';

export default function PatientPayments(){
  const startStripe = async ()=>{
    const r = await apiFetch('/api/payments/stripe/create-checkout', { method:'POST', body:{ amount: 10, userId: 'test-user' } });
    const js = await r.json();
    if(js.url) window.location = js.url;
    else alert('No checkout url');
  };
  const startMpesa = async ()=>{
    const r = await apiFetch('/api/payments/mpesa/stkpush', { method:'POST', body:{ phone: '254700000000', amount: 10, userId:'test-user' } });
    const js = await r.json();
    alert(JSON.stringify(js));
  };
  const startFw = async ()=>{
    const r = await apiFetch('/api/payments/flutterwave/initiate', { method:'POST', body:{ amount: 10, email:'test@example.com', userId:'test-user' } });
    const js = await r.json();
    if(js.link) window.location = js.link;
    else alert('No link');
  };
  return (<div><h2>Payments</h2><button onClick={startStripe}>Pay with Card (Stripe)</button><button onClick={startMpesa}>Pay with M-Pesa</button><button onClick={startFw}>Pay with Flutterwave</button></div>);
}
