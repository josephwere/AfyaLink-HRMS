import React from 'react';
import usePatientPayments from '../../hooks/usePatientPayments';

export default function PatientPayments(){
  const { status, busy, run, payWithCard, payWithMpesa, payWithFlutterwave } = usePatientPayments();
  const startStripe = async ()=> payWithCard();
  const startMpesa = async ()=> payWithMpesa();
  const startFw = async ()=> payWithFlutterwave();
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
