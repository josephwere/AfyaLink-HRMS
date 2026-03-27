import React, {useEffect, useState} from 'react';
import apiFetch from '../../utils/apiFetch';

export default function MappingEditor(){
  const [list,setList]=useState([]);
  const [form,setForm]=useState({ connector:'', name:'', fields: { hl7: {}, fhir: {} } });
  const [editing,setEditing]=useState(null);

  useEffect(()=>{ load(); },[]);

  async function load(){
    const js = await apiFetch('/api/mapping');
    setList(Array.isArray(js) ? js : Array.isArray(js?.items) ? js.items : []);
  }

  function setField(type, path, target){
    setForm(f=>{ const nf = {...f}; nf.fields = {...nf.fields}; nf.fields[type] = {...nf.fields[type]}; nf.fields[type][path]=target; return nf; });
  }

  async function save(){
    if(editing){
      await apiFetch('/api/mapping/' + editing, { method:'PUT', body: form });
      alert('Updated');
    } else {
      await apiFetch('/api/mapping', { method:'POST', body: form });
      alert('Created');
    }
    setForm({ connector:'', name:'', fields: { hl7:{}, fhir:{} } }); setEditing(null); load();
  }

  async function edit(id){
    const js = await apiFetch('/api/mapping/' + id);
    setForm({
      connector: js?.connector || "",
      name: js?.name || "",
      fields: {
        hl7: js?.fields?.hl7 || {},
        fhir: js?.fields?.fhir || {},
      },
    });
    setEditing(id);
  }

  return (<div className="dashboard">
    <h2>Mapping Editor</h2>
    <div className="grid info-grid" style={{ gap: 12 }}>
      <div className="card form">
        <h3>Create / Edit</h3>
        <input placeholder='connector id' value={form.connector} onChange={e=>setForm(f=>({...f,connector:e.target.value}))} />
        <input placeholder='name' value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} />
        <h4>HL7 mappings (example PID-5.1 => firstName)</h4>
        <textarea placeholder='one per line: PID-5.1=firstName' onBlur={e=>{ const obj={}; e.target.value.split('\n').map(l=>l.trim()).filter(Boolean).forEach(line=>{ const [k,v]=line.split('='); if(k && v) obj[k.trim()]=v.trim(); }); setForm(f=>({...f,fields:{...f.fields,hl7:obj}})); }} style={{width:'100%',height:120}} />
        <h4>FHIR mappings (json path dot notation)</h4>
        <textarea placeholder='one per line: name[0].given[0]=firstName' onBlur={e=>{ const obj={}; e.target.value.split('\n').map(l=>l.trim()).filter(Boolean).forEach(line=>{ const [k,v]=line.split('='); if(k && v) obj[k.trim()]=v.trim(); }); setForm(f=>({...f,fields:{...f.fields,fhir:obj}})); }} style={{width:'100%',height:120}} />
        <div><button type="button" className="btn-primary" onClick={save}>Save Mapping</button></div>
      </div>
      <div className="card">
        <h3>Existing Mappings</h3>
        {list.map(m=>(
          <div key={m._id} style={{padding:8,margin:8,background:'#fff1'}}>
            <div>{m.name}</div>
            <div>Connector: {m.connector}</div>
            <button type="button" className="btn-secondary" onClick={()=>edit(m._id)}>Edit</button>
          </div>
        ))}
      </div>
    </div>
  </div>);
}
