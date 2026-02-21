import React, {useEffect, useState} from "react";

/**
 * Admin Reports
 * - Builds a CSV report from lab_tests and allows download
 * - Simple filters by date
 */

function loadTests(){ try{ return JSON.parse(localStorage.getItem("lab_tests")||"[]"); }catch(e){return [];}}

function toCSV(rows){
  if(!rows || rows.length===0) return "";
  const keys = Object.keys(rows[0]);
  const esc = v => '"'+String(v).replace(/"/g,'""')+'"';
  const lines = [keys.map(esc).join(",")].concat(rows.map(r=> keys.map(k=>esc(r[k]||"")).join(",")));
  return lines.join("\n");
}

export default function Reports(){
  const [tests, setTests] = useState([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(()=> setTests(loadTests()), []);

  const filtered = tests.filter(t=>{
    if(from && t.date && t.date < from) return false;
    if(to && t.date && t.date > to) return false;
    return true;
  });

  function downloadCSV(){
    const csv = toCSV(filtered);
    const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lab-report-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{padding:20}}>
      <h2>Reports</h2>
      <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:12}}>
        <label>From <input type="date" value={from} onChange={e=>setFrom(e.target.value)} /></label>
        <label>To <input type="date" value={to} onChange={e=>setTo(e.target.value)} /></label>
        <button onClick={downloadCSV}>Download CSV ({filtered.length})</button>
      </div>

      <table border="1" cellPadding="6" style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr><th>Patient</th><th>Test</th><th>Result</th><th>Date</th></tr></thead>
        <tbody>
          {filtered.map(t=> <tr key={t.id}><td>{t.patientName}</td><td>{t.testType}</td><td>{t.result}</td><td>{t.date}</td></tr>)}
          {filtered.length===0 && <tr><td colSpan="4" style={{textAlign:"center"}}>No entries match filters.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
