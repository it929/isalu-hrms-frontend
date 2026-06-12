"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

const SidebarContext = createContext();

export function SidebarProvider({ children }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Load preference from localStorage on mount, adapting for mobile default
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth <= 768) {
        setIsCollapsed(true);
      } else {
        const saved = localStorage.getItem('sidebar-collapsed');
        if (saved !== null) {
          setIsCollapsed(JSON.parse(saved));
        }
      }
    }
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', JSON.stringify(next));
      return next;
    });
  };

  return (
    <SidebarContext.Provider value={{ isCollapsed, toggleSidebar, setIsCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}
