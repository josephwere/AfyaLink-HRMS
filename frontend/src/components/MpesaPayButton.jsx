import React, { useState } from "react";

/**
 * Props:
 *  - amount (number)
 *  - phone (string) optional (if not provided shows input)
 *  - onSuccess / onError callbacks (optional)
 */
export default function MpesaPayButton({ amount = 100, initialPhone = "", onSuccess, onError }) {
  const [phone, setPhone] = useState(initialPhone);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const startPayment = async () => {
    setMsg(null);

    // Basic front-end validation — use same validator util on backend too
    if (!/^2547\d{8}$/.test(phone)) {
      setMsg("Enter phone in Kenyan format: 2547XXXXXXXX");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`import.meta.env.VITE_API_URL}'}/api/payments/mpesa/stkpush", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, amount }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || JSON.stringify(data));

      setMsg("STK initiated — check your phone for the prompt.");
      onSuccess?.(data);
    } catch (err) {
      console.error("STK error", err);
      setMsg("Failed to start payment: " + (err.message || err));
      onError?.(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 420 }}>
      <label style={{ display: "block", marginBottom: 8 }}>
        Phone (2547XXXXXXXX)
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value.trim())}
          placeholder="2547XXXXXXXX"
          style={{ width: "100%", padding: 8, marginTop: 6 }}
        />
      </label>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={startPayment} disabled={loading} style={{ flex: 1, padding: 10 }}>
          {loading ? "Processing…" : `Pay KES ${amount}`}
        </button>
      </div>

      {msg && <p style={{ marginTop: 10 }}>{msg}</p>}
    </div>
  );
}
