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
        <div className="premium-note-grid">
          <div className="premium-note">
            <strong>Purpose</strong>
            <span>Use this console for direct gateway smoke tests before exposing a rail to production users.</span>
          </div>
          <div className="premium-note">
            <strong>Guardrail</strong>
            <span>Only tokenized or sandbox-safe payment data should be used here. Never enter raw PAN or CVV.</span>
          </div>
        </div>
      </section>

      <div className="premium-split">
        <section className="card premium-card form premium-stack">
          <label>Amount</label>
          <input
            type="number"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <p className="premium-form-hint">
            Amount is passed directly to the payment adapters so you can verify request shape and gateway responses.
          </p>

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
        </section>

        <aside className="card premium-card premium-stack">
          <div className="premium-tag">Gateway output</div>
          <p className="premium-status-message">
            Responses from payment adapters are captured here so finance or engineering can verify payload quality without opening dev tools.
          </p>
          {result ? (
            <div className="premium-console">
              <pre>{result}</pre>
            </div>
          ) : (
            <div className="premium-empty">
              <strong>No gateway response yet</strong>
              <span>Run any payment action to inspect the live request output.</span>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
