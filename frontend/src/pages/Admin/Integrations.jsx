import React, { useEffect, useState } from 'react';
import apiFetch from '../../utils/apiFetch';
import PasswordInput from "../../components/PasswordInput";

const isDev = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV;

export default function Integrations(){
  const [list,setList]=useState([]);
  const [form,setForm]=useState({ name:'', type:'rest', url:'', apiKey:'', authType:'none', username:'', password:'', retryPolicy:{ attempts:5, backoffType:'exponential', backoffDelay:1000 } });
  const [testResult,setTestResult]=useState(null); // { message, details? }

  useEffect(()=>{ load(); },[]);
  async function load(){
    const js = await apiFetch('/api/connectors');
    setList(Array.isArray(js) ? js : Array.isArray(js?.items) ? js.items : []);
  }

  async function save(){
    const js = await apiFetch('/api/connectors', { method:'POST', body: form });
    alert('Saved: ' + (js?._id || "connector"));
    load();
  }

  async function test(id){
    setTestResult({ message: "Running connection check...", details: "" });
    try {
      const js = await apiFetch('/api/connectors/' + id + '/test');
      setTestResult({
        message: js?.ok ? "Connection successful." : "Connection check completed.",
        details: isDev ? JSON.stringify(js, null, 2) : "",
      });
    } catch (e) {
      setTestResult({
        message: e?.message || "Connection check failed.",
        details: isDev ? JSON.stringify({ message: e?.message, status: e?.status, code: e?.code }, null, 2) : "",
      });
    }
  }

  async function testFhir(id){
    setTestResult({ message: "Running FHIR check...", details: "" });
    try {
      const js = await apiFetch('/api/connectors/' + id + '/test-fhir');
      setTestResult({
        message: js?.ok ? "FHIR check successful." : "FHIR check completed.",
        details: isDev ? JSON.stringify(js, null, 2) : "",
      });
    } catch (e) {
      setTestResult({
        message: e?.message || "FHIR check failed.",
        details: isDev ? JSON.stringify({ message: e?.message, status: e?.status, code: e?.code }, null, 2) : "",
      });
    }
  }

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
        <div><button type="button" className="btn-primary" onClick={save}>Save Connector</button></div>
      </div>
      <div className="card">
        <h3>Existing</h3>
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
        </div>
      </section>
    ) : null}
  </div>);
}
