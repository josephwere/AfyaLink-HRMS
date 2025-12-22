import React from 'react';
import { StatCard } from '../../components/Cards';
export default function Dashboard(){
  return (
    <div>
      <h2>Doctor Dashboard</h2>
      <div className="grid">
        <StatCard title="My Patients" value="124" />
        <StatCard title="Today's Visits" value="9" />
        <StatCard title="Lab Results Pending" value="3" />
      </div>
    </div>
  );
}
