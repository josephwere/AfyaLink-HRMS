import React from 'react';
import PasswordInput from "../../components/PasswordInput";
import { useAdminIntegrations } from "../../hooks/useAdminIntegrations";

const isDev = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV;

export default function Integrations(){
  const { list, form, setForm, testResult, setTestResult, loading, saving, save, test, testFhir } = useAdminIntegrations();

  return (<div className="dashboard">
    <div className="welcome-panel">
      <div>
        <h2>Integrations</h2>
        <p className="muted">Connect AfyaLink to partner systems and keep data flowing reliably.</p>
      </div>
    </div>

    <div className="grid info-grid" style={{ gap: 12 }}>
      <div className="card form">
        <h3>New Connector</h3>
        <input placeholder='Connector name' value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} />
        <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}><option value='rest'>REST</option><option value='webhook'>Webhook</option><option value='import'>Import</option><option value='sync'>Sync</option></select>
        <input placeholder='Endpoint URL' value={form.url} onChange={e=>setForm(f=>({...f,url:e.target.value}))} />
        <select value={form.authType} onChange={e=>setForm(f=>({...f,authType:e.target.value}))}><option value='none'>None</option><option value='apikey'>API Key</option><option value='basic'>Basic</option></select>
        {form.authType==='apikey' && (
          <PasswordInput
            label=""
            placeholder="Integration key"
            value={form.apiKey}
            autoComplete="off"
            onChange={e=>setForm(f=>({...f,apiKey:e.target.value}))}
          />
        )}
        {form.authType==='basic' && (<><input placeholder='username' value={form.username} onChange={e=>setForm(f=>({...f,username:e.target.value}))} /><PasswordInput label="" placeholder="password" value={form.password} autoComplete="current-password" onChange={e=>setForm(f=>({...f,password:e.target.value}))} /></>)}
        <div><h4>Delivery Policy</h4>
          <label>Attempts</label><input type='number' value={form.retryPolicy.attempts} onChange={e=>setForm(f=>({...f,retryPolicy:{...f.retryPolicy,attempts: Number(e.target.value)}}))} />
          <label>Backoff Type</label><select value={form.retryPolicy.backoffType} onChange={e=>setForm(f=>({...f,retryPolicy:{...f.retryPolicy,backoffType: e.target.value}}))}><option value='exponential'>Exponential</option><option value='fixed'>Fixed</option></select>
          <label>Delay (ms)</label><input type='number' value={form.retryPolicy.backoffDelay} onChange={e=>setForm(f=>({...f,retryPolicy:{...f.retryPolicy,backoffDelay: Number(e.target.value)}}))} />
        </div>
        <div><button type="button" className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Connector'}</button></div>
      </div>
      <div className="card">
        <h3>Existing</h3>
        {loading ? <p className="muted">Loading...</p> : null}
        {list.map(l=>(
          <div key={l._id} style={{padding:8,margin:8,background:'#fff1'}}>
            <div>{l.name} ({l.type})</div>
            <div>Last sync: {l.lastSync || 'never'}</div>
            <button type="button" className="btn-secondary" onClick={()=>test(l._id)}>Test REST</button>{" "}
            <button type="button" className="btn-secondary" onClick={()=>testFhir(l._id)}>Test FHIR</button>
          </div>
        ))}
      </div>
    </div>

    {testResult?.message ? (
      <section className="section">
        <div className="card">
          <h3>Connection Check</h3>
          <p className="muted">{testResult.message}</p>
          {isDev && testResult.details ? <pre className="code-inline">{testResult.details}</pre> : null}
          {testResult.message !== 'Saved: connector' && testResult.message !== 'Saved: ' ? null : <button type="button" className="btn-secondary" onClick={() => setTestResult(null)} style={{ marginTop: 8 }}>Dismiss</button>}
        </div>
      </section>
    ) : null}
  </div>);
}
