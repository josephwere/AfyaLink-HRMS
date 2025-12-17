import React, {useEffect, useState} from 'react';
import { apiFetch } from '../../services/api';

function mask(s){ if(!s) return ''; return s.replace(/.(?=.{4})/g, '*'); }

export default function PaymentSettings(){
  const [meta,setMeta]=useState({});
  const [form,setForm]=useState({ stripePublishable:'', stripeSecret:'', mpesaConsumerKey:'', mpesaConsumerSecret:'', mpesaShortcode:'', flutterSecret:'', mode:'test', adminPassword:'', otp:'' });
  const [step,setStep]=useState('edit'); // edit, otp_requested
  useEffect(()=>{ load(); },[]);
  async function load(){ const r = await apiFetch('/api/payment-settings/meta'); const js = await r.json(); setMeta(js); }
  async function save(){
    if(!form.adminPassword || form.adminPassword.length < 8){ alert('Admin password required and must be >=8 chars'); return; }
    const payload = { stripe: { publishable: form.stripePublishable, secret: form.stripeSecret }, mpesa: { consumerKey: form.mpesaConsumerKey, consumerSecret: form.mpesaConsumerSecret, shortcode: form.mpesaShortcode }, flutterwave: { secret: form.flutterSecret }, mode: form.mode, adminPassword: form.adminPassword };
    const r = await apiFetch('/api/payment-settings/save', { method:'POST', body: payload });
    const js = await r.json();
    alert(JSON.stringify(js));
  }
  async function requestOtp(){
    const r = await apiFetch('/api/payment-settings/request-2fa', { method:'POST' });
    const js = await r.json();
    if(js.ok) setStep('otp_requested');
    alert(js.message || JSON.stringify(js));
  }
  async function verify(){
    const r = await apiFetch('/api/payment-settings/verify-2fa', { method:'POST', body: { code: form.otp, adminPassword: form.adminPassword } });
    const js = await r.json();
    if(js.ok){ alert('Secrets revealed: ' + JSON.stringify(js.secrets)); setStep('edit'); }
    else alert(JSON.stringify(js));
  }
  async function rotate(){
    const old = prompt('Enter OLD admin password');
    const nw = prompt('Enter NEW admin password (store it safely)');
    if(!old || !nw) return;
    const r = await apiFetch('/api/payment-settings/rotate-password', { method:'POST', body: { oldPassword: old, newPassword: nw } });
    const js = await r.json();
    alert(JSON.stringify(js));
  }
  return (<div><h2>Payment Settings</h2>
    <div><label>Stripe Publishable</label><input value={form.stripePublishable} onChange={e=>setForm(f=>({...f,stripePublishable:e.target.value}))} /></div>
    <div><label>Stripe Secret</label><input value={form.stripeSecret} onChange={e=>setForm(f=>({...f,stripeSecret:e.target.value}))} /></div>
    <div><label>MPESA Consumer Key</label><input value={form.mpesaConsumerKey} onChange={e=>setForm(f=>({...f,mpesaConsumerKey:e.target.value}))} /></div>
    <div><label>MPESA Consumer Secret</label><input value={form.mpesaConsumerSecret} onChange={e=>setForm(f=>({...f,mpesaConsumerSecret:e.target.value}))} /></div>
    <div><label>MPESA Shortcode</label><input value={form.mpesaShortcode} onChange={e=>setForm(f=>({...f,mpesaShortcode:e.target.value}))} /></div>
    <div><label>Flutter Secret</label><input value={form.flutterSecret} onChange={e=>setForm(f=>({...f,flutterSecret:e.target.value}))} /></div>
    <div><label>Admin Password (required to encrypt)</label><input type='password' value={form.adminPassword} onChange={e=>setForm(f=>({...f,adminPassword:e.target.value}))} /></div>
    <div style={{marginTop:12}}><button onClick={save}>Save Settings (Encrypted)</button> <button onClick={requestOtp}>Request 2FA</button> <button onClick={rotate}>Rotate Admin Password</button></div>
    {step==='otp_requested' && (<div style={{marginTop:12}}><label>Enter OTP</label><input value={form.otp} onChange={e=>setForm(f=>({...f,otp:e.target.value}))} /><button onClick={verify}>Verify & Reveal</button></div>)}
    <div style={{marginTop:12}}><h4>Metadata</h4><pre>{JSON.stringify(meta,null,2)}</pre></div>
  </div>);
}
