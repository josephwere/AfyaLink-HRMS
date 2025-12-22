import React from 'react';
import { StatCard } from '../../components/Cards';
export default function Dashboard(){
  return (
    <div>
      <h2>Hospital Admin Dashboard</h2>
      <div className="grid">
        <StatCard title="Today's Appointments" value="84" />
        <StatCard title="Pending Transfers" value="4" />
        <StatCard title="Revenue (M)" value="$12.4" />
      </div>
    </div>
  );
}
