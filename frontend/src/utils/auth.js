import React, { createContext, useContext, useState } from 'react';
const AuthContext = createContext(null);
export const AuthProvider = ({children}) => {
  const [user, setUser] = useState(null);
  const login = (u, token) => {
    setUser(u);
    localStorage.setItem('token', token);
  };
  const logout = () => {
    setUser(null);
    localStorage.removeItem('token');
  };
  return <AuthContext.Provider value={{user, login, logout}}>{children}</AuthContext.Provider>;
};
export const useAuth = ()=> useContext(AuthContext);
