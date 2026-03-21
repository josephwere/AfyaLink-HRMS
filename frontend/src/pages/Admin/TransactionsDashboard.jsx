import React, {useEffect, useRef, useState} from 'react';
import { useNavigate } from "react-router-dom";
import apiFetch from '../../utils/apiFetch';
import { LineChart, Line, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, BarChart, Bar, ResponsiveContainer } from 'recharts';
import { listTransfers } from "../../services/transferApi";

export default function TransactionsDashboard(){
  const navigate = useNavigate();
  const transactionsTableRef = useRef(null);
  const [rows,setRows]=useState([]);
  const [summary,setSummary]=useState([]);
  const [filters,setFilters]=useState({ provider:'', status:'', min:'', max:'', start:'', end:'', search:'' });
  const [chartData,setChartData]=useState([]);
  const [transfers, setTransfers] = useState([]);
  const [transferError, setTransferError] = useState("");
  useEffect(()=>{ fetchData(); },[]);
  useEffect(()=>{ loadTransfers(); },[]);

  async function fetchData(exportCsv=false, currentFilters=filters){
    const qs = new URLSearchParams({...currentFilters, limit:500});
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

  function applySummaryFilter(summaryKey) {
    const key = String(summaryKey || "").toLowerCase();
    const nextFilters = { ...filters };
    if (["stripe", "mpesa", "flutterwave"].includes(key)) {
      nextFilters.provider = key;
      nextFilters.status = "";
    } else if (["pending", "success", "failed"].includes(key)) {
      nextFilters.status = key;
      nextFilters.provider = "";
    } else {
      nextFilters.search = summaryKey || "";
    }
    setFilters(nextFilters);
    fetchData(false, nextFilters);
    transactionsTableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function loadTransfers() {
    try {
      const data = await listTransfers({ limit: 6, scope: "global" });
      const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      setTransfers(items);
      setTransferError("");
    } catch (err) {
      setTransfers([]);
      setTransferError(err?.message || "Unable to load transfers.");
    }
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
      {summary.map((s,i)=>(
        <div
          key={i}
          className="kpi-card kpi-card-clickable"
          role="button"
          tabIndex={0}
          onClick={() => applySummaryFilter(s._id)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              applySummaryFilter(s._id);
            }
          }}
        >
          <div className="kpi-label">{s._id}</div>
          <div className="kpi-value">{s.total}</div>
        </div>
      ))}
    </div>

    <div className="card" style={{height:300}}>
      <ResponsiveContainer><LineChart data={chartData}><XAxis dataKey='_id'/><YAxis/><Tooltip/><Line type='monotone' dataKey='total' stroke='#8884d8' /></LineChart></ResponsiveContainer>
    </div>

    <section className="section">
      <div className="card">
        <div className="card-header-actions">
          <div>
            <h3>Transfer Continuity</h3>
            <p className="muted">Recent transfers and handoff status.</p>
          </div>
          <div className="action-pill">
            Pending: {transfers.filter((t) => t.status === "Pending").length}
          </div>
        </div>
        {transferError ? <div className="muted">{transferError}</div> : null}
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table className="doctor-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Route</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((t) => (
                <tr key={t._id}>
                  <td>{t?.patient?.firstName || ""} {t?.patient?.lastName || ""}</td>
                  <td>{t?.fromHospital?.name || t?.fromHospital?.code || "—"} → {t?.toHospital?.name || t?.toHospital?.code || "—"}</td>
                  <td>{t.status}</td>
                </tr>
              ))}
              {transfers.length === 0 ? (
                <tr>
                  <td colSpan="3" className="muted">No transfers yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <div className="grid" style={{gridTemplateColumns:"repeat(auto-fit, minmax(min(100%, 280px), 1fr))"}}>
      <div className="card" style={{height:300}}>
        <h4>Provider Distribution</h4>
        <ResponsiveContainer><PieChart><Pie data={summary} dataKey='total' nameKey='_id' cx='50%' cy='50%' outerRadius={80}>{summary.map((entry, index)=>(<Cell key={index} fill={COLORS[index%COLORS.length]} />))}</Pie></PieChart></ResponsiveContainer>
      </div>
      <div className="card" ref={transactionsTableRef}>
        <div className="table-wrap">
          <table className="table lite"><thead><tr><th>Ref</th><th>Provider</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>{rows.map(r=>(<tr key={r._id}><td>{r.reference}</td><td>{r.provider}</td><td>{r.amount}</td><td>{r.status}</td><td>{new Date(r.createdAt).toLocaleString()}</td></tr>))}</tbody></table>
        </div>
        <div className="doctor-actions-row" style={{ marginTop: 12 }}>
          <button type="button" className="btn-secondary" onClick={() => navigate("/hospital-admin/transfer-command-center")}>
            Transfer Command Center
          </button>
        </div>
      </div>
    </div>
  </div>);
}
