import React, { useEffect, useState } from "react";
import { listTransfers, verifyTransferProvenance } from "../../services/transferApi";

export default function ProvenanceVerify() {
  const [transfers, setTransfers] = useState([]);
  const [transferId, setTransferId] = useState("");
  const [payload, setPayload] = useState("{}");
  const [signature, setSignature] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [result, setResult] = useState(null);

  const loadTransfers = async () => {
    try {
      const data = await listTransfers({ limit: 50 });
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
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Transfer Provenance Verify</h2>
          <p className="muted">Verify signed transfer payload integrity for receiving hospitals.</p>
        </div>
        <div className="welcome-actions">
          <button className="btn-secondary" onClick={loadTransfers}>Refresh Transfers</button>
        </div>
      </div>

      {msg && <div className="card">{msg}</div>}

      <section className="section">
        <div className="card">
          <label>Transfer</label>
          <select value={transferId} onChange={(e) => setTransferId(e.target.value)}>
            {transfers.map((t) => (
              <option key={t._id} value={t._id}>
                {t._id} • {t.status}
              </option>
            ))}
          </select>

          <label style={{ marginTop: 12 }}>Payload (JSON)</label>
          <textarea
            rows={8}
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

          <div className="welcome-actions">
            <button className="btn-primary" onClick={verify} disabled={loading || !transferId || !signature}>
              {loading ? "Verifying..." : "Verify Signature"}
            </button>
          </div>
        </div>
      </section>

      <section className="section">
        <h3>Verification Result</h3>
        <div className="card">
          {result ? (
            <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          ) : (
            <p className="muted">No verification result yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}

