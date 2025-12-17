import React, {useState} from 'react';
import { triage } from '../../services/aiClient';
export default function Triage(){
  const [symptoms,setSymptoms]=useState('');
  const [res,setRes]=useState(null);
  const run = async ()=> { setRes(await triage(symptoms)); };
  return (<div>
    <h2>AI Triage (placeholder)</h2>
    <textarea value={symptoms} onChange={e=>setSymptoms(e.target.value)} rows={4} style={{width:'100%'}}/>
    <button onClick={run}>Triage</button>
    <pre>{JSON.stringify(res,null,2)}</pre>
  </div>);
}
