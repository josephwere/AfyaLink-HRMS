import React, {useEffect, useState} from 'react';
import { apiFetch } from '../../utils/apiFetch';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function ConnectorAnalytics(){
  const [data,setData]=useState([]);

  useEffect(()=>{ load(); },[]);
  async function load(){
    try {
      const js = await apiFetch('/api/connectors/analytics/list');
      setData(Array.isArray(js) ? js : Array.isArray(js?.items) ? js.items : []);
    } catch {
      setData([]);
    }
  }

  return (
    <div className="dashboard">
      <h2>Connector Analytics</h2>
      <div className="card" style={{ height: 300 }}>
        <ResponsiveContainer>
          <BarChart data={data}>
            <XAxis dataKey='name' />
            <YAxis />
            <Tooltip />
            <Bar dataKey='lastSync' fill='#8884d8' />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="card">
        <pre>{JSON.stringify(data, null, 2)}</pre>
      </div>
    </div>
  );
}
