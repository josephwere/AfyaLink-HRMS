import React, {useEffect, useState} from 'react';
import { apiFetch } from '../../services/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function ConnectorAnalytics(){
  const [data,setData]=useState([]);

  useEffect(()=>{ load(); },[]);
  async function load(){ const r = await apiFetch('/api/connectors/analytics/list'); const js = await r.json(); setData(js); }

  return (<div><h2>Connector Analytics</h2>
    <div style={{height:300}}><ResponsiveContainer><BarChart data={data}><XAxis dataKey='name' /><YAxis /><Tooltip /><Bar dataKey='lastSync' fill='#8884d8' /></BarChart></ResponsiveContainer></div>
    <pre>{JSON.stringify(data,null,2)}</pre>
  </div>);
}
