import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../utils/auth';
export default function Protected({ children, roles }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && roles.length && !roles.includes(user.role)) return <div>Access denied</div>;
  return children;
}
