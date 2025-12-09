import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './utils/auth';
import SocketProvider from './utils/socket';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import SuperAdminDashboard from './pages/SuperAdmin/Dashboard';
import RBAC from './pages/SuperAdmin/RBAC';
import ML from './pages/SuperAdmin/ML';
import HospitalAdminDashboard from './pages/HospitalAdmin/Dashboard';
import DoctorDashboard from './pages/Doctor/Dashboard';
import PatientDashboard from './pages/Patient/Dashboard';
import Patients from './pages/HospitalAdmin/Patients';
import Appointments from './pages/Doctor/Appointments';
import LabTests from './pages/LabTech/LabTests';
import Financials from './pages/HospitalAdmin/Financials';
import Notifications from './components/Notifications';

function Protected({ children, roles }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <div>Access denied</div>;
  return children;
}

export default function App(){
  return (
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter>
          <Navbar />
          <div className="app-grid">
            <Sidebar />
            <main className="main">
              <Notifications />
              <Routes>
                <Route path="/" element={<div>Welcome to AfyaLink HRMS</div>} />
                <Route path="/superadmin" element={<Protected roles={['SuperAdmin']}><SuperAdminDashboard/></Protected>} />
                <Route path="/superadmin/rbac" element={<Protected roles={['SuperAdmin']}><RBAC/></Protected>} />
                <Route path="/superadmin/ml" element={<Protected roles={['SuperAdmin']}><ML/></Protected>} />
                <Route path="/hospitaladmin" element={<Protected roles={['HospitalAdmin']}><HospitalAdminDashboard/></Protected>} />
                <Route path="/hospitaladmin/patients" element={<Protected roles={['HospitalAdmin']}><Patients/></Protected>} />
                <Route path="/hospitaladmin/financials" element={<Protected roles={['HospitalAdmin']}><Financials/></Protected>} />
                <Route path="/doctor/appointments" element={<Protected roles={['Doctor']}><Appointments/></Protected>} />
                <Route path="/labtech/labs" element={<Protected roles={['LabTech']}><LabTests/></Protected>} />
                <Route path="/doctor" element={<Protected roles={['Doctor']}><DoctorDashboard/></Protected>} />
                <Route path="/patient" element={<Protected roles={['Patient']}><PatientDashboard/></Protected>} />
                <Route path="*" element={<div>Not found</div>} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  );
}
