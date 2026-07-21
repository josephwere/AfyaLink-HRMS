import React from 'react';
import { useConnectorRetryPolicy } from '../../hooks/useConnectorRetryPolicy';

export default function ConnectorRetryPolicy(){
  const { connectors, selectedConnectorId, setSelectedConnectorId, policy, setPolicy, message, save } = useConnectorRetryPolicy();

  return (
    <div className="dashboard">
      <h2>Connector Delivery Policies</h2>
      <div className="card form">
        <select value={selectedConnectorId} onChange={e=>setSelectedConnectorId(e.target.value)}>
          <option value=''>Select</option>
          {connectors.map(c => (<option key={c._id} value={c._id}>{c.name}</option>))}
        </select>
        <div><label>Attempts</label><input type='number' value={policy.attempts} onChange={e=>setPolicy(p=>({...p,attempts: Number(e.target.value)}))} /></div>
        <div><label>Backoff Delay (ms)</label><input type='number' value={policy.backoffDelay} onChange={e=>setPolicy(p=>({...p,backoffDelay: Number(e.target.value)}))} /></div>
        <div><label>Backoff Type</label><select value={policy.backoffType} onChange={e=>setPolicy(p=>({...p,backoffType:e.target.value}))}><option value='exponential'>exponential</option><option value='fixed'>fixed</option></select></div>
        <div><button type="button" className="btn-primary" onClick={save}>Save Policy</button></div>
      </div>
      {message ? <p className="muted">{message}</p> : null}
    </div>
  );
}
