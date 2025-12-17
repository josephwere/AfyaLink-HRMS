import React from 'react';
import { StatCard } from '../../components/Cards';
export default function Dashboard(){
  return (
    <div>
      <h2>Patient Dashboard</h2>
      <div className="grid">
        <StatCard title="Upcoming Appointments" value="1" />
        <StatCard title="Outstanding Bills" value="$0" />
      </div>
    </div>
  );
}
