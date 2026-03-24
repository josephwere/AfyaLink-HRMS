import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../../components/Cards";
import { listTransfers, verifyTransferProvenance } from "../../services/transferApi";

export default function ProvenanceVerify() {
  const navigate = useNavigate();
  const [transfers, setTransfers] = useState([]);
  const [transferId, setTransferId] = useState("");
  const [payload, setPayload] = useState("{}");
  const [signature, setSignature] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [result, setResult] = useState(null);

  const loadTransfers = async () => {
    try {
      const data = await listTransfers({ limit: 50, scope: "global" });
      const items = Array.isArray(data?.items) ? data.items : [];
      setTransfers(items);
      if (!transferId && items[0]?._id) setTransferId(items[0]._id);
    } catch {
      setTransfers([]);
    }
  };

  useEffect(() => {
    loadTransfers();
  }, []);

  const selectedTransfer = useMemo(
    () => transfers.find((item) => item._id === transferId) || null,
    [transferId, transfers]
  );

  const verify = async () => {
    setLoading(true);
    setMsg("");
    setResult(null);
    try {
      const parsed = JSON.parse(payload || "{}");
      const out = await verifyTransferProvenance({
        transferId,
        payload: parsed,
        signature,
      });
      setResult(out);
    } catch (e) {
      setMsg(e?.message || "Failed to verify provenance");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard developer-console-page">
      <section className="welcome-panel premium-card developer-console-hero">
        <div className="developer-console-hero-copy">
          <div className="developer-console-kicker">Integrity validation</div>
          <h2>Transfer Provenance Verify</h2>
          <p className="muted">Verify signed transfer payload integrity from a cleaner forensic-style provenance workspace.</p>
          <div className="welcome-actions">
            <button type="button" className="btn-primary" onClick={verify} disabled={loading || !transferId || !signature}>
              {loading ? "Verifying..." : "Verify Signature"}
            </button>
            <button type="button" className="btn-secondary" onClick={loadTransfers}>Refresh Transfers</button>
            <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/transfer-command-center")}>Transfer Command Center</button>
          </div>
        </div>
        <div className="developer-console-hero-meta">
          <div className="developer-console-pulse neutral">
            <span>Transfers loaded</span>
            <strong>{transfers.length}</strong>
            <small>Recent transfer records available for provenance checks.</small>
          </div>
          <div className={`developer-console-pulse ${signature ? "good" : "warn"}`}>
            <span>Signature status</span>
            <strong>{signature ? "READY" : "MISSING"}</strong>
            <small>{signature ? "Signature value supplied for verification." : "Paste the provenance header before verifying."}</small>
          </div>
          <div className="developer-console-pulse neutral">
            <span>Selected transfer</span>
            <strong>{selectedTransfer?._id ? selectedTransfer._id.slice(-8) : "None"}</strong>
            <small>{selectedTransfer?.status || "Choose a transfer to begin."}</small>
          </div>
          <div className={`developer-console-pulse ${result?.ok === false ? "risk" : result ? "good" : "neutral"}`}>
            <span>Verification</span>
            <strong>{result ? (result.ok === false ? "FAILED" : "SUCCESS") : "Not run"}</strong>
            <small>{result ? "Most recent provenance decision." : "Run once to validate payload integrity."}</small>
          </div>
        </div>
      </section>

      {msg && <div className="premium-inline-note">{msg}</div>}

      <section className="section developer-console-grid">
        <div className="card premium-card developer-editor-card">
          <div className="card-header-actions">
            <div>
              <h3>Verification Input</h3>
              <p className="muted">Choose a transfer, paste the payload JSON, then attach the signature that came with the export.</p>
            </div>
            {selectedTransfer ? <div className="developer-chip">{selectedTransfer.status}</div> : null}
          </div>

          <label>Transfer</label>
          <select value={transferId} onChange={(e) => setTransferId(e.target.value)}>
            {transfers.map((item) => (
              <option key={item._id} value={item._id}>
                {item._id} - {item.status}
              </option>
            ))}
          </select>

          <label style={{ marginTop: 12 }}>Payload (JSON)</label>
          <textarea
            rows={10}
            className="developer-json-input"
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
          />

          <label style={{ marginTop: 12 }}>Signature</label>
          <input
            type="text"
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            placeholder="X-AfyaLink-Provenance signature"
          />
        </div>

        <div className="developer-console-stack">
          <div className="card premium-card developer-console-sidecard">
            <div className="card-header-actions">
              <div>
                <h3>Verification Notes</h3>
                <p className="muted">A quick reminder of what a clean provenance check is protecting.</p>
              </div>
            </div>
            <div className="developer-runbook-list">
              <div className="developer-runbook-item"><strong>Payload integrity</strong><p className="muted">Confirms the transfer payload has not been altered after it was signed.</p></div>
              <div className="developer-runbook-item"><strong>Trust boundaries</strong><p className="muted">Lets receiving hospitals trust exported packets before routing them into downstream workflows.</p></div>
              <div className="developer-runbook-item"><strong>Forensic traceability</strong><p className="muted">Gives the routing team a defensible record during audits or incident review.</p></div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="card-header-actions">
          <div>
            <h3>Verification Result</h3>
            <p className="muted">Result payload, integrity status, and the raw response from the verification endpoint.</p>
          </div>
        </div>
        <div className="grid info-grid">
          <StatCard title="Transfer" value={selectedTransfer?._id ? selectedTransfer._id.slice(-8) : "—"} subtitle={selectedTransfer?.status || "No transfer selected"} />
          <StatCard title="Signature" value={signature ? "READY" : "MISSING"} status={signature ? "good" : "warn"} subtitle="Header presence before submit" />
          <StatCard title="Verification" value={result ? (result.ok === false ? "FAILED" : "SUCCESS") : "—"} status={result ? (result.ok === false ? "risk" : "good") : "neutral"} subtitle="Latest run status" />
        </div>
        <div className="card premium-card developer-result-card">
          {result ? (
            <pre className="developer-result-pre">{JSON.stringify(result, null, 2)}</pre>
          ) : (
            <div className="developer-empty-state compact">
              <strong>No verification result yet.</strong>
              <p className="muted">Run a provenance check to render the signed verification output here.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
