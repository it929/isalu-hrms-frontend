"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

const SessionContext = createContext();

export function SessionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [activeModule, setActiveModule] = useState(null);
  const [activeRole, setActiveRole] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // In the future, this will fetch from Laravel API. For now, checking local storage.
    const savedUser = localStorage.getItem('hrms_user');
    const savedModule = localStorage.getItem('hrms_module');
    const savedRole = localStorage.getItem('hrms_role');
    
    if (savedUser) setUser(JSON.parse(savedUser));
    if (savedModule) setActiveModule(JSON.parse(savedModule));
    if (savedRole) setActiveRole(JSON.parse(savedRole));
    
    setIsLoading(false);
  }, []);

  const login = (userData, roleData) => {
    setUser(userData);
    setActiveRole(roleData);
    localStorage.setItem('hrms_user', JSON.stringify(userData));
    localStorage.setItem('hrms_role', JSON.stringify(roleData));
  };

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/nextjs';

  const logout = async () => {
    try {
      const savedUser = localStorage.getItem('hrms_user');
      const uid = savedUser ? JSON.parse(savedUser)?.id : null;
      if (uid && typeof window !== 'undefined') {
        const headers = { 'X-User-Id': uid };
        fetch(`${API_BASE}/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify({ user_id: uid })
        }).catch(() => {});
      }
    } catch (e) {
      /* ignore */
    }

    setUser(null);
    setActiveModule(null);
    setActiveRole(null);
    localStorage.removeItem('hrms_user');
    localStorage.removeItem('hrms_module');
    localStorage.removeItem('hrms_role');
  };

  const selectModule = (moduleData) => {
    setActiveModule(moduleData);
    localStorage.setItem('hrms_module', JSON.stringify(moduleData));
  };

  return (
    <SessionContext.Provider value={{
      user,
      activeModule,
      activeRole,
      isLoading,
      login,
      logout,
      selectModule
    }}>
      {children}
    </SessionContext.Provider>
  );
}

export const useSession = () => useContext(SessionContext);
