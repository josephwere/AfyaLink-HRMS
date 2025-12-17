import React from 'react';
import { Route, Navigate } from 'react-router-dom';

export default function RoleRoute({ element: Element, allowedRoles, user, ...rest }) {
  // If no user, redirect to login
  if (!user) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(user.role)) return <Navigate to="/unauthorized" replace />;
  return <Route {...rest} element={<Element />} />;
}
