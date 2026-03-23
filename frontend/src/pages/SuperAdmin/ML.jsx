import React, {useState} from 'react';
import { apiFetch } from '../../utils/apiFetch';
export default function ML(){
  const [model, setModel] = useState(null);
  const [msg, setMsg] = useState("");
  const train = async ()=>{
    try {
      const data = await apiFetch('/api/ml/train', { method: 'POST', body: [{example:1}] });
      setModel(data);
      setMsg("Model trained");
    } catch (e) {
      setMsg(e?.message || "Training failed");
    }
  };
  const predict = async ()=>{
    if(!model) return setMsg('Train first');
    try {
      const data = await apiFetch('/api/ml/'+model.modelId+'/predict', { method: 'POST', body: { input: {} } });
      setMsg(JSON.stringify(data));
    } catch (e) {
      setMsg(e?.message || "Prediction failed");
    }
  };
  return (
    <div className="dashboard premium-shell">
      <section className="premium-card premium-shell-head">
        <div className="premium-shell-kicker">ML control</div>
        <div className="card-header-actions">
          <div>
            <h1 className="premium-shell-title">ML Admin</h1>
            <p className="premium-shell-subtitle">
              Internal model sandbox for training placeholder artifacts and validating prediction wiring from the super admin layer.
            </p>
          </div>
          <div className="premium-shell-meta">
            <div className="premium-shell-stat">
              <span>Model</span>
              <strong>{model?.modelId ? "Ready" : "Idle"}</strong>
            </div>
            <div className="premium-shell-stat">
              <span>Output</span>
              <strong>{msg ? "Fresh" : "Waiting"}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="card premium-card premium-stack">
        <div className="welcome-actions">
          <button type="button" className="btn-secondary" onClick={train}>Train placeholder model</button>
          <button type="button" className="btn-primary" onClick={predict}>Run prediction</button>
        </div>
        {msg ? <div className="premium-inline-note">{msg}</div> : null}
        {model ? (
          <div className="premium-console">
            <pre>{JSON.stringify(model, null, 2)}</pre>
          </div>
        ) : (
          <div className="premium-empty">
            <strong>No model artifact yet</strong>
            <span>Train the placeholder model first, then use prediction to validate the serving path.</span>
          </div>
        )}
      </section>
    </div>
  );
}
