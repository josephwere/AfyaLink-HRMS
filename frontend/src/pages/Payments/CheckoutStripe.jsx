import React from 'react';
import { loadStripe } from '@stripe/stripe-js';
import apiFetch from '../../utils/apiFetch';

export default function CheckoutStripe(){
  const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE || "");
  const start = async () => {
    try {
      const js = await apiFetch('/api/payments/stripe/create-intent', {
        method: 'POST',
        body: { amount: 1000, currency: 'usd' },
      });
      const stripe = await stripePromise;
      const clientSecret = js?.data?.clientSecret || js?.clientSecret;
      if (!stripe || !clientSecret) {
        alert("Stripe is not configured correctly.");
        return;
      }
      alert('Client secret: ' + clientSecret);
    } catch (err) {
      alert(err?.message || "Failed to start Stripe checkout");
    }
  };
  return (<div><h2>Stripe Checkout (demo)</h2><button type="button" onClick={start}>Pay $10</button></div>);
}
