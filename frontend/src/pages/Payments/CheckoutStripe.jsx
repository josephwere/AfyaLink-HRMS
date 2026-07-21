import React from 'react';
import { useStripeCheckout } from '../../hooks/useStripeCheckout';

export default function CheckoutStripe(){
  const { status, start } = useStripeCheckout();
  return (
    <div className="dashboard premium-shell">
      <section className="premium-card premium-shell-head">
        <div className="premium-shell-kicker">Stripe rail</div>
        <div className="card-header-actions">
          <div>
            <h1 className="premium-shell-title">Stripe Checkout</h1>
            <p className="premium-shell-subtitle">
              Lightweight launch surface for testing card intent creation before the full payment workflow takes over.
            </p>
          </div>
          <div className="premium-shell-meta">
            <div className="premium-shell-stat">
              <span>Charge</span>
              <strong>$10</strong>
            </div>
            <div className="premium-shell-stat">
              <span>Mode</span>
              <strong>Intent</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="card premium-card premium-stack">
          <div className="premium-note-grid">
          <div className="premium-note">
            <strong>Gateway</strong>
            <span>Uses the configured Stripe key and payment intent workflow.</span>
          </div>
          <div className="premium-note">
            <strong>Use case</strong>
            <span>Ideal for quick finance QA without navigating the broader billing workspace.</span>
          </div>
        </div>
        <div className="welcome-actions">
          <button type="button" className="btn-primary" onClick={start}>Create $10 intent</button>
        </div>
        {status ? (
          <div className="premium-console">
            <p className="muted" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{status}</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
