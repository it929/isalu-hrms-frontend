"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import SessionTimeoutModal from '@/components/ui/SessionTimeoutModal';

const SessionContext = createContext();

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_TIMEOUT_MS = 28 * 60 * 1000;    // 28 minutes (warning modal for remaining 2 minutes)
const ACTIVITY_THROTTLE_MS = 3000;            // Throttle activity updates to once every 3s
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/nextjs';

export function SessionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [activeModule, setActiveModule] = useState(null);
  const [activeRole, setActiveRole] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Inactivity timeout states
  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(120);
  const lastActivityRef = useRef(Date.now());
  const isLoggingOutRef = useRef(false);

  // Logout method
  const logout = useCallback(async (reason = 'manual') => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;

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
    setShowWarning(false);

    if (typeof window !== 'undefined') {
      localStorage.removeItem('hrms_user');
      localStorage.removeItem('hrms_module');
      localStorage.removeItem('hrms_role');
      localStorage.removeItem('hrms_last_activity');

      if (reason === 'inactivity') {
        window.location.href = '/?reason=inactivity';
      } else {
        window.location.href = '/';
      }
    }
  }, []);

  // Update activity timestamp in state and localStorage
  const recordActivity = useCallback(() => {
    if (!user || isLoggingOutRef.current) return;
    const now = Date.now();
    lastActivityRef.current = now;
    if (typeof window !== 'undefined') {
      localStorage.setItem('hrms_last_activity', String(now));
    }
    setShowWarning(false);
  }, [user]);

  // Initial load from localStorage
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('hrms_user');
      const savedModule = localStorage.getItem('hrms_module');
      const savedRole = localStorage.getItem('hrms_role');
      const savedLastActivity = localStorage.getItem('hrms_last_activity');

      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        const parsedTimestamp = savedLastActivity ? parseInt(savedLastActivity, 10) : null;
        const lastActive = (parsedTimestamp && !isNaN(parsedTimestamp)) ? parsedTimestamp : Date.now();

        // If user was already inactive for > 30 mins before page refresh/re-open
        if (Date.now() - lastActive >= INACTIVITY_TIMEOUT_MS) {
          logout('inactivity');
          setIsLoading(false);
          return;
        }

        setUser(parsedUser);
        lastActivityRef.current = lastActive;
        if (!savedLastActivity) {
          localStorage.setItem('hrms_last_activity', String(Date.now()));
        }
      }

      if (savedModule) {
        try { setActiveModule(JSON.parse(savedModule)); } catch (e) {}
      }
      if (savedRole) {
        try { setActiveRole(JSON.parse(savedRole)); } catch (e) {}
      }
    } catch (e) {
      console.error('Session load error:', e);
      localStorage.removeItem('hrms_user');
    }

    setIsLoading(false);
  }, [logout]);

  const login = (userData, roleData) => {
    isLoggingOutRef.current = false;
    const now = Date.now();
    lastActivityRef.current = now;
    setUser(userData);
    setActiveRole(roleData);
    if (typeof window !== 'undefined') {
      localStorage.setItem('hrms_user', JSON.stringify(userData));
      localStorage.setItem('hrms_role', JSON.stringify(roleData));
      localStorage.setItem('hrms_last_activity', String(now));
    }
  };

  const selectModule = (moduleData) => {
    setActiveModule(moduleData);
    if (typeof window !== 'undefined') {
      localStorage.setItem('hrms_module', JSON.stringify(moduleData));
    }
  };

  // Activity tracking and Inactivity timer effect
  useEffect(() => {
    if (!user || isLoggingOutRef.current) return;
    if (typeof window !== 'undefined' && window.location.pathname === '/') return;

    let lastThrottledTime = Date.now();

    const handleUserActivity = () => {
      const now = Date.now();
      if (now - lastThrottledTime > ACTIVITY_THROTTLE_MS) {
        lastThrottledTime = now;
        recordActivity();
      }
    };

    // Events that indicate active user interaction
    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click', 'wheel'];
    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, handleUserActivity, { passive: true });
    });

    // Check inactivity periodically and update remaining time
    const checkInactivity = () => {
      if (isLoggingOutRef.current) return;
      if (typeof window !== 'undefined' && window.location.pathname === '/') return;

      const storedLastActivity = localStorage.getItem('hrms_last_activity');
      const parsedTimestamp = storedLastActivity ? parseInt(storedLastActivity, 10) : null;
      const lastActive = (parsedTimestamp && !isNaN(parsedTimestamp)) ? parsedTimestamp : lastActivityRef.current;
      const elapsed = Date.now() - lastActive;

      if (elapsed >= INACTIVITY_TIMEOUT_MS) {
        logout('inactivity');
      } else if (elapsed >= WARNING_TIMEOUT_MS) {
        const remaining = Math.max(0, Math.ceil((INACTIVITY_TIMEOUT_MS - elapsed) / 1000));
        setRemainingSeconds(remaining);
        setShowWarning(true);
      } else {
        setShowWarning(false);
      }
    };

    const intervalId = setInterval(checkInactivity, 1000);

    // Synchronize activity across multiple browser tabs
    const handleStorageEvent = (e) => {
      if (e.key === 'hrms_last_activity' && e.newValue) {
        lastActivityRef.current = parseInt(e.newValue, 10);
        setShowWarning(false);
      } else if (e.key === 'hrms_user' && !e.newValue) {
        // User logged out in another tab
        logout('manual');
      }
    };

    // Immediate check when tab becomes visible or gains focus (e.g. computer woke up from sleep)
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        checkInactivity();
      }
    };

    window.addEventListener('storage', handleStorageEvent);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, handleUserActivity);
      });
      clearInterval(intervalId);
      window.removeEventListener('storage', handleStorageEvent);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [user, recordActivity, logout]);

  return (
    <SessionContext.Provider value={{
      user,
      activeModule,
      activeRole,
      isLoading,
      login,
      logout,
      selectModule,
      recordActivity
    }}>
      {children}
      {user && (
        <SessionTimeoutModal
          isOpen={showWarning}
          remainingSeconds={remainingSeconds}
          onStayLoggedIn={recordActivity}
          onLogout={() => logout('manual')}
        />
      )}
    </SessionContext.Provider>
  );
}

export const useSession = () => useContext(SessionContext);
