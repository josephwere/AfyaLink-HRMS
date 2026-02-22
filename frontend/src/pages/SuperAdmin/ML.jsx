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
    <div className="dashboard">
      <h3>ML Admin</h3>
      <div className="welcome-actions">
        <button type="button" className="btn-secondary" onClick={train}>Train placeholder model</button>
        <button type="button" className="btn-primary" onClick={predict}>Predict</button>
      </div>
      {msg ? <p className="muted">{msg}</p> : null}
      {model && <div className="card"><pre>{JSON.stringify(model,null,2)}</pre></div>}
    </div>
  );
}
