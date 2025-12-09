import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import HospitalAdminDashboard from './pages/HospitalAdminDashboard';
import DoctorDashboard from './pages/DoctorDashboard';
import NurseDashboard from './pages/NurseDashboard';
import LabTechDashboard from './pages/LabTechDashboard';
import PatientDashboard from './pages/PatientDashboard';

function App(){
  // simple user stub; in real app replace with auth context
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={ user ? <Navigate to={`/${user.role}/dashboard`} replace /> : <Navigate to="/login" replace />} />
        <Route path="/superadmin/dashboard" element={<SuperAdminDashboard />} />
        <Route path="/hospitaladmin/dashboard" element={<HospitalAdminDashboard />} />
        <Route path="/doctor/dashboard" element={<DoctorDashboard />} />
        <Route path="/nurse/dashboard" element={<NurseDashboard />} />
        <Route path="/labtech/dashboard" element={<LabTechDashboard />} />
        <Route path="/patient/dashboard" element={<PatientDashboard />} />
      </Routes>
    </Router>
  );
}
export default App;
