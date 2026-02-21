import React, {useEffect, useState, useMemo} from "react";

/**
 * Admin Analytics
 * - Reads lab tests from localStorage (lab_tests) and patients from CRDT SDK (if any)
 * - Displays simple KPIs and an SVG bar chart for tests per day
 */

function loadTests(){ try{ return JSON.parse(localStorage.getItem("lab_tests")||"[]"); }catch(e){return [];}}

export default function Analytics(){
  const [tests, setTests] = useState([]);
  useEffect(()=> setTests(loadTests()), []);
  const total = tests.length;
  const positive = tests.filter(t=> t.result && t.result.toLowerCase().includes("pos")).length;
  const byDate = useMemo(()=>{
    const map = {};
    tests.forEach(t=>{
      const d = t.date || (t.createdAt && t.createdAt.slice(0,10)) || "unknown";
      map[d] = (map[d]||0) + 1;
    });
    const arr = Object.keys(map).sort().map(k=>({date:k,count:map[k]}));
    return arr;
  }, [tests]);

  const max = Math.max(1, ...byDate.map(d=>d.count));

  return (
    <div className="dashboard">
      <div className="welcome-panel">
        <div>
          <h2>Admin Analytics</h2>
          <p className="muted">Overview of lab test volume and positivity trends.</p>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total lab tests</div>
          <div className="kpi-value">{total}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Positive results (contains 'pos')</div>
          <div className="kpi-value">{positive}</div>
        </div>
      </div>

      <div className="card">
        <h3>Tests per day</h3>
        <div aria-hidden style={{width:"100%",height:200,border:"1px solid #eee",padding:10}}>
          {byDate.length===0 && <div style={{color:"#666"}}>No data to chart.</div>}
          {byDate.length>0 && (
            <svg width="100%" height="160" viewBox={`0 0 ${byDate.length*60} 160`} preserveAspectRatio="xMidYMid meet">
              {byDate.map((d,i)=>{
                const h = (d.count/max)*120;
                return (
                  <g key={d.date} transform={`translate(${i*60},0)`}>
                    <rect x="10" y={140-h} width="30" height={h} rx="4" />
                    <text x="25" y="155" fontSize="10" textAnchor="middle">{d.date}</text>
                    <text x="25" y={135-h} fontSize="10" textAnchor="middle">{d.count}</text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>
      </div>

      <div className="card">
        <h3>Recent tests</h3>
        <div className="table-wrap">
          <table className="table lite">
            <thead><tr><th>Patient</th><th>Test</th><th>Result</th><th>Date</th></tr></thead>
            <tbody>
              {tests.slice(0,10).map(t=>(
                <tr key={t.id}><td>{t.patientName}</td><td>{t.testType}</td><td>{t.result}</td><td>{t.date}</td></tr>
              ))}
              {tests.length===0 && <tr><td colSpan="4" style={{textAlign:"center"}}>No tests yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
