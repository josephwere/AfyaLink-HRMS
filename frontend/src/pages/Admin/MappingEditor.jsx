import React, {useEffect, useState} from 'react';
import { apiFetch } from '../../services/api';

export default function MappingEditor(){
  const [list,setList]=useState([]);
  const [form,setForm]=useState({ connector:'', name:'', fields: { hl7: {}, fhir: {} } });
  const [editing,setEditing]=useState(null);

  useEffect(()=>{ load(); },[]);

  async function load(){ const r = await apiFetch('/api/mappings'); const js = await r.json(); setList(js); }

  function setField(type, path, target){
    setForm(f=>{ const nf = {...f}; nf.fields = {...nf.fields}; nf.fields[type] = {...nf.fields[type]}; nf.fields[type][path]=target; return nf; });
  }

  async function save(){
    if(editing){
      const r = await apiFetch('/api/mappings/' + editing, { method:'PUT', body: form });
      const js = await r.json();
      alert('Updated');
    } else {
      const r = await apiFetch('/api/mappings', { method:'POST', body: form });
      const js = await r.json();
      alert('Created');
    }
    setForm({ connector:'', name:'', fields: { hl7:{}, fhir:{} } }); setEditing(null); load();
  }

  async function edit(id){
    const r = await apiFetch('/api/mappings/' + id);
    const js = await r.json();
    setForm(js); setEditing(id);
  }

  return (<div>
    <h2>Mapping Editor</h2>
    <div style={{display:'flex', gap:12}}>
      <div style={{flex:1}}>
        <h3>Create / Edit</h3>
        <input placeholder='connector id' value={form.connector} onChange={e=>setForm(f=>({...f,connector:e.target.value}))} /><br/>
        <input placeholder='name' value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} /><br/>
        <h4>HL7 mappings (example PID-5.1 => firstName)</h4>
        <textarea placeholder='one per line: PID-5.1=firstName' onBlur={e=>{ const obj={}; e.target.value.split('\n').map(l=>l.trim()).filter(Boolean).forEach(line=>{ const [k,v]=line.split('='); if(k && v) obj[k.trim()]=v.trim(); }); setForm(f=>({...f,fields:{...f.fields,hl7:obj}})); }} style={{width:'100%',height:120}} />
        <h4>FHIR mappings (json path dot notation)</h4>
        <textarea placeholder='one per line: name[0].given[0]=firstName' onBlur={e=>{ const obj={}; e.target.value.split('\n').map(l=>l.trim()).filter(Boolean).forEach(line=>{ const [k,v]=line.split('='); if(k && v) obj[k.trim()]=v.trim(); }); setForm(f=>({...f,fields:{...f.fields,fhir:obj}})); }} style={{width:'100%',height:120}} />
        <div><button onClick={save}>Save Mapping</button></div>
      </div>
      <div style={{flex:1}}>
        <h3>Existing Mappings</h3>
        {list.map(m=>(<div key={m._id} style={{padding:8,margin:8,background:'#fff1'}}><div>{m.name}</div><div>Connector: {m.connector}</div><button onClick={()=>edit(m._id)}>Edit</button></div>))}
      </div>
    </div>
  </div>);
}
