import React, { useState } from "react";
import { useAuth } from "../../utils/auth";
import { apiFetch } from "../../utils/auth";

/**
 * Payments Page
 * - Stripe (create payment intent)
 * - M-Pesa STK Push
 * - JWT protected
 * - Role safe
 */

export default function PaymentsPage() {
  const { user } = useAuth();
  const [amount, setAmount] = useState(1000);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  if (!user) {
    return <div>Please log in to make payments.</div>;
  }

  /* =========================
     STRIPE
  ========================= */
  const payStripe = async () => {
    setLoading(true);
    setMsg("");

    try {
      const res = await apiFetch("/payments/stripe/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Stripe failed");

      setMsg(
        "Stripe Payment Intent created.\nClient Secret:\n" +
          data.clientSecret
      );
    } catch (err) {
      setMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  /* =========================
     M-PESA
  ========================= */
  const payMpesa = async () => {
    if (!phone) {
      setMsg("Enter phone number e.g. 2547XXXXXXXX");
      return;
    }

    setLoading(true);
    setMsg("");

    try {
      const res = await apiFetch("/payments/mpesa/stk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, phone }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "M-Pesa failed");

      setMsg("M-Pesa STK Push sent successfully.");
    } catch (err) {
      setMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  /* =========================
     UI
  ========================= */
  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      <h2>Payments</h2>

      <div style={{ marginBottom: 12 }}>
        <label>Amount (KES)</label>
        <input
          type="number"
          value={amount}
          min={1}
          onChange={(e) => setAmount(Number(e.target.value))}
          style={{ width: "100%", padding: 8 }}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label>M-Pesa Phone</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="2547XXXXXXXX"
          style={{ width: "100%", padding: 8 }}
        />
      </div>

      <button
        onClick={payStripe}
        disabled={loading}
        style={{ width: "100%", marginBottom: 10 }}
      >
        Pay with Stripe
      </button>

      <button
        onClick={payMpesa}
        disabled={loading}
        style={{ width: "100%" }}
      >
        Pay with M-Pesa (STK)
      </button>

      {msg && (
        <pre
          style={{
            marginTop: 16,
            padding: 12,
            background: "#f3f4f6",
            whiteSpace: "pre-wrap",
          }}
        >
          {msg}
        </pre>
      )}
    </div>
  );
}
