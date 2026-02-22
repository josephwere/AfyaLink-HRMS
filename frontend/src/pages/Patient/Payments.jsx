import React from 'react';
import apiFetch from '../../utils/apiFetch';

export default function PatientPayments(){
  const startStripe = async ()=>{
    const js = await apiFetch('/api/payments/stripe/create-intent', {
      method:'POST',
      body:{ amount: 10, currency: 'usd' },
    });
    alert(js?.data?.clientSecret || js?.clientSecret || "Stripe intent created.");
  };
  const startMpesa = async ()=>{
    const js = await apiFetch('/api/payments/mpesa/stk', {
      method:'POST',
      body:{ phone: '254700000000', amount: 10 },
    });
    alert(JSON.stringify(js));
  };
  const startFw = async ()=>{
    const js = await apiFetch('/api/payments/flutter/init', {
      method:'POST',
      body:{ amount: 10, email:'test@example.com' },
    });
    if(js?.data?.link) window.location = js.data.link;
    else alert(JSON.stringify(js));
  };
  return (
    <div>
      <h2>Payments</h2>
      <button type="button" onClick={startStripe}>Pay with Card (Stripe)</button>
      <button type="button" onClick={startMpesa}>Pay with M-Pesa</button>
      <button type="button" onClick={startFw}>Pay with Flutterwave</button>
    </div>
  );
}
