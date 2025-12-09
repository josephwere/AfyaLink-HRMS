import React from 'react';
import { Link } from 'react-router-dom';
export default function Sidebar(){
  return (
    <aside className="sidebar">
      <nav>
        <ul>
          <li><Link to="/">Home</Link></li>
          <li><Link to="/superadmin">SuperAdmin</Link></li>
          <li><Link to="/hospitaladmin">HospitalAdmin</Link></li>
          <li><Link to="/doctor">Doctor</Link></li>
          <li><Link to="/patient">Patient</Link></li>
        <li><a href="/hospitaladmin/patients">Patients</a></li><li><a href="/hospitaladmin/financials">Financials</a></li><li><a href="/doctor/appointments">Appointments</a></li><li><a href="/labtech/labs">Lab Tests</a></li></ul>
      <div style={{marginTop:20}}><a href="/superadmin/rbac">Role Management</a></div><div style={{marginTop:8}}><a href="/superadmin/ml">ML Admin</a></div></nav>
      <div className="sidebar-footer">AfyaLink • Secure</div>
    </aside>
  );
}
