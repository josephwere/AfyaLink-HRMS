import React, {useEffect, useState} from 'react';
import { apiFetch } from '../../services/api';
import { LineChart, Line, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, BarChart, Bar, ResponsiveContainer } from 'recharts';

export default function TransactionsDashboard(){
  const [rows,setRows]=useState([]);
  const [summary,setSummary]=useState([]);
  const [filters,setFilters]=useState({ provider:'', status:'', min:'', max:'', start:'', end:'', search:'' });
  const [chartData,setChartData]=useState([]);
  useEffect(()=>{ fetchData(); },[]);

  async function fetchData(exportCsv=false){
    const qs = new URLSearchParams({...filters, limit:500});
    if(exportCsv) qs.set('exportCsv','1');
    const url = '/api/transactions?' + qs.toString();
    if(exportCsv){
      const res = await fetch(url, { credentials:'include' });
      const blob = await res.blob();
      const urlb = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = urlb; a.download = 'transactions.csv'; document.body.appendChild(a); a.click(); a.remove();
      return;
    }
    const r = await apiFetch('/transactions?' + qs.toString());
    const js = await r.json();
    setRows(js.data || []);
    const s = await apiFetch('/transactions/summary');
    const sj = await s.json();
    setSummary(sj.data || []);
    // prepare chart data: revenue per day
    const resp = await apiFetch('/analytics/revenue/daily');
    const rp = await resp.json();
    setChartData(rp);
  }

  const COLORS = ['#0088FE','#00C49F','#FFBB28','#FF8042'];

  return (<div>
    <h2>Transactions</h2>
    <div style={{display:'flex',gap:12,alignItems:'center'}}>
      <input placeholder='search' value={filters.search} onChange={e=>setFilters(f=>({...f,search:e.target.value}))} />
      <select value={filters.provider} onChange={e=>setFilters(f=>({...f,provider:e.target.value}))}><option value=''>All</option><option value='stripe'>Stripe</option><option value='mpesa'>M-Pesa</option><option value='flutterwave'>Flutterwave</option></select>
      <select value={filters.status} onChange={e=>setFilters(f=>({...f,status:e.target.value}))}><option value=''>All</option><option value='pending'>pending</option><option value='success'>success</option><option value='failed'>failed</option></select>
      <input type='date' value={filters.start} onChange={e=>setFilters(f=>({...f,start:e.target.value}))} />
      <input type='date' value={filters.end} onChange={e=>setFilters(f=>({...f,end:e.target.value}))} />
      <button onClick={()=>fetchData(false)}>Apply</button>
      <button onClick={()=>fetchData(true)}>Export CSV</button>
    </div>

    <div style={{display:'flex',gap:12,marginTop:12}}>
      {summary.map((s,i)=>(<div key={i} style={{padding:12,background:'#fff1',borderRadius:8}}><div>{s._id}</div><div>{s.total}</div></div>))}
    </div>

    <div style={{height:300, marginTop:12}}>
      <ResponsiveContainer><LineChart data={chartData}><XAxis dataKey='_id'/><YAxis/><Tooltip/><Line type='monotone' dataKey='total' stroke='#8884d8' /></LineChart></ResponsiveContainer>
    </div>

    <div style={{display:'flex',gap:12,marginTop:12}}>
      <div style={{width:300,height:300}}>
        <h4>Provider Distribution</h4>
        <ResponsiveContainer><PieChart><Pie data={summary} dataKey='total' nameKey='_id' cx='50%' cy='50%' outerRadius={80}>{summary.map((entry, index)=>(<Cell key={index} fill={COLORS[index%COLORS.length]} />))}</Pie></PieChart></ResponsiveContainer>
      </div>
      <div style={{flex:1}}>
        <table style={{width:'100%'}}><thead><tr><th>Ref</th><th>Provider</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
        <tbody>{rows.map(r=>(<tr key={r._id}><td>{r.reference}</td><td>{r.provider}</td><td>{r.amount}</td><td>{r.status}</td><td>{new Date(r.createdAt).toLocaleString()}</td></tr>))}</tbody></table>
      </div>
    </div>
  </div>);
}
