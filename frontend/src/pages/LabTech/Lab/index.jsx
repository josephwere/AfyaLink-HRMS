import React, {useState, useEffect} from "react";

/**
 * LabTech Lab Page
 * - CRUD for lab tests (stored in localStorage under 'lab_tests')
 * - Simple search and pagination
 */

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }

function loadTests(){
  try{
    return JSON.parse(localStorage.getItem("lab_tests")||"[]");
  }catch(e){ return []; }
}
function saveTests(tests){ localStorage.setItem("lab_tests", JSON.stringify(tests)); }

export default function Lab(){
  const [tests, setTests] = useState([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({patientName:"", testType:"", result:"", date:""});

  useEffect(()=> setTests(loadTests()), []);

  function openNew(){
    setForm({patientName:"", testType:"", result:"", date:new Date().toISOString().slice(0,10)});
    setEditing(null);
    document.getElementById("lab-form-scroll")?.scrollIntoView({behavior:"smooth"});
  }

  function openEdit(t){
    setEditing(t.id);
    setForm({...t});
    document.getElementById("lab-form-scroll")?.scrollIntoView({behavior:"smooth"});
  }

  function removeTest(id){
    if(!confirm("Delete test?")) return;
    const next = tests.filter(t=>t.id!==id);
    saveTests(next);
    setTests(next);
  }

  function save(e){
    e.preventDefault();
    if(!form.patientName || !form.testType){
      alert("Please provide patient name and test type.");
      return;
    }
    let next;
    if(editing){
      next = tests.map(t=> t.id===editing ? {...form, id:editing} : t);
    } else {
      const newItem = {...form, id: uid(), createdAt: new Date().toISOString()};
      next = [newItem, ...tests];
    }
    saveTests(next);
    setTests(next);
    setEditing(null);
    setForm({patientName:"", testType:"", result:"", date:""});
  }

  const filtered = tests.filter(t=>{
    const q = query.toLowerCase();
    return !q || (t.patientName && t.patientName.toLowerCase().includes(q)) || (t.testType && t.testType.toLowerCase().includes(q));
  });

  return (
    <div style={{padding:20}}>
      <h2>Laboratory — Tests</h2>

      <div style={{display:"flex",gap:10,marginBottom:16}}>
        <button onClick={openNew}>➕ New Test</button>
        <input placeholder="Search by patient or test type" value={query} onChange={e=>setQuery(e.target.value)} style={{flex:1}} />
      </div>

      <div id="lab-form-scroll" style={{marginBottom:20}}>
        <form onSubmit={save} style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
          <input placeholder="Patient name" value={form.patientName} onChange={e=>setForm({...form, patientName:e.target.value})} />
          <input placeholder="Test type" value={form.testType} onChange={e=>setForm({...form, testType:e.target.value})} />
          <input placeholder="Result" value={form.result} onChange={e=>setForm({...form, result:e.target.value})} />
          <input type="date" value={form.date} onChange={e=>setForm({...form, date:e.target.value})} />
          <button type="submit">{editing ? "Save changes" : "Create test"}</button>
          {editing && <button type="button" onClick={()=>{setEditing(null); setForm({patientName:"", testType:"", result:"", date:""})}}>Cancel</button>}
        </form>
      </div>

      <table border="1" cellPadding="6" style={{width:"100%",borderCollapse:"collapse"}}>
        <thead>
          <tr>
            <th>Patient</th>
            <th>Test</th>
            <th>Result</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length===0 && <tr><td colSpan="5" style={{textAlign:"center"}}>No tests yet.</td></tr>}
          {filtered.map(t=>(
            <tr key={t.id}>
              <td>{t.patientName}</td>
              <td>{t.testType}</td>
              <td>{t.result}</td>
              <td>{t.date}</td>
              <td>
                <button onClick={()=>openEdit(t)}>Edit</button>{" "}
                <button onClick={()=>removeTest(t.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
