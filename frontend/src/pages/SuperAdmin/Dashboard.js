import React from 'react';
import { StatCard } from '../../components/Cards';
export default function Dashboard(){
  return (
    <div>
      <h2>SuperAdmin Dashboard</h2>
      <div className="grid">
        <StatCard title="Hospitals" value="12" subtitle="Active hospitals" />
        <StatCard title="Users" value="352" subtitle="Total users" />
        <StatCard title="Patients" value="5,321" subtitle="Registered patients" />
      </div>
    </div>
  );
}
