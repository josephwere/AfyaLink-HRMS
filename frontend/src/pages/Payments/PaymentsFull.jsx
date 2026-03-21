import React, { useState } from "react";
import apiFetch from "../../utils/apiFetch";

export default function PaymentsPageFull() {
  const [amount, setAmount] = useState(100);
  const [busy, setBusy] = useState("");
  const [result, setResult] = useState("");

  async function runAction(kind, request) {
    setBusy(kind);
    setResult("");
    try {
      const payload = await request();
      setResult(JSON.stringify(payload, null, 2));
    } catch (err) {
      setResult(err?.message || "Payment request failed.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="dashboard premium-shell payments-shell">
      <section className="premium-card premium-shell-head">
        <div className="premium-shell-kicker">Gateway sandbox</div>
        <div className="card-header-actions">
          <div>
            <h1 className="premium-shell-title">Payments Full</h1>
            <p className="premium-shell-subtitle">
              Quick integration console for direct payment gateway checks without leaving the app.
            </p>
          </div>
          <div className="premium-shell-meta">
            <div className="premium-shell-stat">
              <span>Mode</span>
              <strong>Sandbox</strong>
            </div>
            <div className="premium-shell-stat">
              <span>Amount</span>
              <strong>{Number(amount || 0).toLocaleString()}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="card premium-card form">
        <label>Amount</label>
        <input
          type="number"
          min="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <div className="premium-method-grid">
          <button
            type="button"
            className="premium-method-card recommended"
            disabled={busy === "stripe"}
            onClick={() =>
              runAction("stripe", async () =>
                apiFetch("/api/payments/stripe/create-intent", {
                  method: "POST",
                  body: { amount: Number(amount) },
                })
              )
            }
          >
            <div className="premium-method-card__top">
              <span className="premium-method-card__emoji">💳</span>
              <span className="premium-method-card__label">Pay with Stripe</span>
            </div>
            <div className="premium-method-card__meta">
              {busy === "stripe" ? "Creating intent..." : "Create payment intent"}
            </div>
          </button>

          <button
            type="button"
            className="premium-method-card"
            disabled={busy === "mpesa"}
            onClick={() =>
              runAction("mpesa", async () =>
                apiFetch("/api/payments/mpesa/stk", {
                  method: "POST",
                  body: {
                    amount: Number(amount),
                    phone: "2547XXXXXXXX",
                  },
                })
              )
            }
          >
            <div className="premium-method-card__top">
              <span className="premium-method-card__emoji">📱</span>
              <span className="premium-method-card__label">Pay with M-Pesa</span>
            </div>
            <div className="premium-method-card__meta">
              {busy === "mpesa" ? "Sending STK push..." : "Trigger STK push"}
            </div>
          </button>
        </div>

        {result ? <pre className="premium-code">{result}</pre> : null}
      </section>
    </div>
  );
}
