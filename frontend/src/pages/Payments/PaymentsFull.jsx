import React, { useState } from "react";
import apiFetch from "../../utils/apiFetch";


export default function PaymentsPageFull() {
  const [amount, setAmount] = useState(100);

  async function payStripe() {
    const js = await apiFetch("/api/payments/stripe/create-intent", {
      method: "POST",
      body: { amount: Number(amount) },
    });
    const clientSecret = js?.data?.clientSecret || js?.clientSecret;

    alert(`Client secret: ${clientSecret || "N/A"}\n(Use Stripe.js on frontend to complete payment)`);
  }

  async function payMpesa() {
    const js = await apiFetch("/api/payments/mpesa/stk", {
      method: "POST",
      body: {
        amount: Number(amount),
        phone: "2547XXXXXXXX",
      },
    });
    alert(JSON.stringify(js, null, 2));
  }

  return (
    <div>
      <h2>Payments</h2>

      <div>
        <label>Amount: </label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>

      <button type="button" onClick={payStripe}>
        Pay with Stripe (create intent)
      </button>

      <button type="button" onClick={payMpesa}>
        Pay with M-Pesa (STK push)
      </button>
    </div>
  );
}
