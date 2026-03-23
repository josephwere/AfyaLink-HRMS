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

  const summary = {
    connectors: data.length,
    healthy: data.filter((item) => Number(item?.lastSync || 0) > 0).length,
  };

  return (
    <div className="dashboard premium-shell">
      <section className="premium-card premium-shell-head">
        <div className="premium-shell-kicker">Connector telemetry</div>
        <div className="card-header-actions">
          <div>
            <h1 className="premium-shell-title">Connector Analytics</h1>
            <p className="premium-shell-subtitle">
              Operational view of integration sync activity so admins can spot stale connectors before they become outages.
            </p>
          </div>
          <div className="premium-shell-meta">
            <div className="premium-shell-stat">
              <span>Connectors</span>
              <strong>{summary.connectors}</strong>
            </div>
            <div className="premium-shell-stat">
              <span>Reporting</span>
              <strong>{summary.healthy}</strong>
            </div>
          </div>
        </div>
      </section>

      <div className="premium-split">
        <section className="card premium-card" style={{ minHeight: 360 }}>
          <ResponsiveContainer>
            <BarChart data={data}>
              <XAxis dataKey='name' />
              <YAxis />
              <Tooltip />
              <Bar dataKey='lastSync' fill='#0f766e' radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
        <aside className="card premium-card premium-stack">
          <div className="premium-tag">Raw payload</div>
          <div className="premium-console">
            <pre>{JSON.stringify(data, null, 2)}</pre>
          </div>
        </aside>
      </div>
    </div>
  );
}
