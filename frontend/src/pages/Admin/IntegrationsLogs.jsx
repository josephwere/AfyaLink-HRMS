import React, {useEffect, useState} from 'react';
import apiFetch from '../../utils/apiFetch';

export default function IntegrationsLogs(){
  const [logs,setLogs]=useState([]);
  useEffect(()=>{ load(); },[]);
  async function load(){
    try {
      const js = await apiFetch('/api/audit?limit=100');
      setLogs(Array.isArray(js?.data) ? js.data : Array.isArray(js) ? js : []);
    } catch {
      setLogs([]);
    }
  }
  return (
    <div className="dashboard">
      <h2>Integration Logs</h2>
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l._id}>
                  <td>{new Date(l.createdAt).toLocaleString()}</td>
                  <td>{l.action}</td>
                  <td><pre>{JSON.stringify(l.details, null, 2)}</pre></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
