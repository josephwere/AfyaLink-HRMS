import React, {useEffect, useState} from 'react';
import apiFetch from '../../utils/apiFetch';
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
    const js = await apiFetch('/api/transactions?' + qs.toString());
    setRows(Array.isArray(js?.data) ? js.data : Array.isArray(js) ? js : []);
    const sj = await apiFetch('/api/transactions/summary');
    setSummary(Array.isArray(sj?.data) ? sj.data : Array.isArray(sj) ? sj : []);
    // prepare chart data: revenue per day
    const rp = await apiFetch('/api/analytics/revenue/daily');
    setChartData(Array.isArray(rp) ? rp : Array.isArray(rp?.items) ? rp.items : []);
  }

  const COLORS = ['#0088FE','#00C49F','#FFBB28','#FF8042'];

  return (<div className="dashboard">
    <div className="welcome-panel">
      <div>
        <h2>Transactions</h2>
        <p className="muted">Filter, review, chart, and export transaction activity.</p>
      </div>
    </div>
    <div className="card">
      <div className="welcome-actions">
        <input placeholder='search' value={filters.search} onChange={e=>setFilters(f=>({...f,search:e.target.value}))} />
        <select value={filters.provider} onChange={e=>setFilters(f=>({...f,provider:e.target.value}))}><option value=''>All</option><option value='stripe'>Stripe</option><option value='mpesa'>M-Pesa</option><option value='flutterwave'>Flutterwave</option></select>
        <select value={filters.status} onChange={e=>setFilters(f=>({...f,status:e.target.value}))}><option value=''>All</option><option value='pending'>pending</option><option value='success'>success</option><option value='failed'>failed</option></select>
        <input type='date' value={filters.start} onChange={e=>setFilters(f=>({...f,start:e.target.value}))} />
        <input type='date' value={filters.end} onChange={e=>setFilters(f=>({...f,end:e.target.value}))} />
        <button type="button" className="btn-secondary" onClick={()=>fetchData(false)}>Apply</button>
        <button type="button" className="btn-secondary" onClick={()=>fetchData(true)}>Export CSV</button>
      </div>
    </div>

    <div className="kpi-grid">
      {summary.map((s,i)=>(<div key={i} className="kpi-card"><div className="kpi-label">{s._id}</div><div className="kpi-value">{s.total}</div></div>))}
    </div>

    <div className="card" style={{height:300}}>
      <ResponsiveContainer><LineChart data={chartData}><XAxis dataKey='_id'/><YAxis/><Tooltip/><Line type='monotone' dataKey='total' stroke='#8884d8' /></LineChart></ResponsiveContainer>
    </div>

    <div className="grid" style={{gridTemplateColumns:"repeat(auto-fit, minmax(min(100%, 280px), 1fr))"}}>
      <div className="card" style={{height:300}}>
        <h4>Provider Distribution</h4>
        <ResponsiveContainer><PieChart><Pie data={summary} dataKey='total' nameKey='_id' cx='50%' cy='50%' outerRadius={80}>{summary.map((entry, index)=>(<Cell key={index} fill={COLORS[index%COLORS.length]} />))}</Pie></PieChart></ResponsiveContainer>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table className="table lite"><thead><tr><th>Ref</th><th>Provider</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>{rows.map(r=>(<tr key={r._id}><td>{r.reference}</td><td>{r.provider}</td><td>{r.amount}</td><td>{r.status}</td><td>{new Date(r.createdAt).toLocaleString()}</td></tr>))}</tbody></table>
        </div>
      </div>
    </div>
  </div>);
}
