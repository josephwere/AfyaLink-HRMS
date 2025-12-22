import React from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { apiFetch } from '../../services/api';

export default function CheckoutStripe(){
  const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE);
  const start = async () => {
    const res = await apiFetch('/api/payments/stripe/create-intent', { method: 'POST', body: { amount: 1000, currency: 'usd' } });
    const js = await res.json();
    const stripe = await stripePromise;
    const { clientSecret } = js;
    alert('Client secret: ' + clientSecret);
  };
  return (<div><h2>Stripe Checkout (demo)</h2><button onClick={start}>Pay $10</button></div>);
}
