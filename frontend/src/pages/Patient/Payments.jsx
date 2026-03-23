import React from 'react';
import apiFetch from '../../utils/apiFetch';

export default function PatientPayments(){
  const [status, setStatus] = React.useState("");
  const [busy, setBusy] = React.useState("");
  const run = async (key, fn) => {
    setBusy(key);
    setStatus("");
    try {
      const js = await fn();
      setStatus(JSON.stringify(js, null, 2));
    } catch (err) {
      setStatus(err?.message || "Payment request failed");
    } finally {
      setBusy("");
    }
  };
  const startStripe = async ()=>{
    return apiFetch('/api/payments/stripe/create-intent', {
      method:'POST',
      body:{ amount: 10, currency: 'usd' },
    });
  };
  const startMpesa = async ()=>{
    return apiFetch('/api/payments/mpesa/stk', {
      method:'POST',
      body:{ phone: '254700000000', amount: 10 },
    });
  };
  const startFw = async ()=>{
    return apiFetch('/api/payments/flutter/init', {
      method:'POST',
      body:{ amount: 10, email:'test@example.com' },
    });
  };
  return (
    <div className="dashboard premium-shell">
      <section className="premium-card premium-shell-head">
        <div className="premium-shell-kicker">Patient payments</div>
        <div className="card-header-actions">
          <div>
            <h1 className="premium-shell-title">Payment Options</h1>
            <p className="premium-shell-subtitle">
              Clean patient-facing launcher for card, mobile money, and regional checkout flows.
            </p>
          </div>
          <div className="premium-shell-meta">
            <div className="premium-shell-stat">
              <span>Card</span>
              <strong>Stripe</strong>
            </div>
            <div className="premium-shell-stat">
              <span>Mobile</span>
              <strong>M-Pesa</strong>
            </div>
            <div className="premium-shell-stat">
              <span>Regional</span>
              <strong>Flutterwave</strong>
            </div>
          </div>
        </div>
      </section>

      <div className="premium-split">
        <section className="card premium-card premium-stack">
          <div className="premium-method-grid">
            <button type="button" className="premium-method-card recommended" disabled={busy === "stripe"} onClick={() => run("stripe", startStripe)}>
              <div className="premium-method-card__top">
                <span className="premium-method-card__emoji">💳</span>
                <span className="premium-method-card__label">Pay with Card</span>
              </div>
              <div className="premium-method-card__meta">{busy === "stripe" ? "Creating intent..." : "Stripe checkout"}</div>
            </button>
            <button type="button" className="premium-method-card" disabled={busy === "mpesa"} onClick={() => run("mpesa", startMpesa)}>
              <div className="premium-method-card__top">
                <span className="premium-method-card__emoji">📱</span>
                <span className="premium-method-card__label">Pay with M-Pesa</span>
              </div>
              <div className="premium-method-card__meta">{busy === "mpesa" ? "Sending STK push..." : "Kenya mobile money"}</div>
            </button>
            <button type="button" className="premium-method-card" disabled={busy === "flutter"} onClick={() => run("flutter", startFw)}>
              <div className="premium-method-card__top">
                <span className="premium-method-card__emoji">🌍</span>
                <span className="premium-method-card__label">Pay with Flutterwave</span>
              </div>
              <div className="premium-method-card__meta">{busy === "flutter" ? "Preparing checkout..." : "Regional checkout rail"}</div>
            </button>
          </div>
        </section>

        <aside className="card premium-card premium-stack">
          <div className="premium-tag">Payment response</div>
          {status ? (
            <div className="premium-console">
              <pre>{status}</pre>
            </div>
          ) : (
            <div className="premium-empty">
              <strong>No payment action yet</strong>
              <span>Pick a payment rail to see the live checkout or token response.</span>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
