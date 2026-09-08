"use client";

import React from 'react';
import { Clock, LogOut, ArrowRight } from 'lucide-react';

export default function SessionTimeoutModal({ isOpen, remainingSeconds, onStayLoggedIn, onLogout }) {
  if (!isOpen) return null;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(6px)',
      padding: '1rem'
    }}>
      <div style={{
        background: 'var(--surface, #ffffff)',
        color: 'var(--foreground, #1e293b)',
        borderRadius: '16px',
        border: '1px solid var(--border, #e2e8f0)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        width: '100%',
        maxWidth: '440px',
        padding: '2rem',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1.25rem'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          backgroundColor: 'rgba(245, 158, 11, 0.15)',
          color: '#f59e0b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Clock size={32} />
        </div>

        <div>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.3rem', fontWeight: '700' }}>
            Session Expiring Soon
          </h3>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--secondary, #64748b)', lineHeight: 1.5 }}>
            You have been inactive for nearly 30 minutes. For your security, your session will automatically expire in:
          </p>
        </div>

        <div style={{
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: '12px',
          padding: '0.85rem 2rem',
          fontSize: '2.2rem',
          fontWeight: '800',
          letterSpacing: '3px',
          color: '#d97706',
          fontFamily: 'monospace'
        }}>
          {formattedTime}
        </div>

        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--secondary, #94a3b8)' }}>
          Moving your mouse or pressing any key will also keep you signed in.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', width: '100%', marginTop: '0.5rem' }}>
          <button
            type="button"
            onClick={onLogout}
            style={{
              flex: 1,
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              border: '1px solid var(--border, #cbd5e1)',
              background: 'transparent',
              color: 'var(--foreground, #475569)',
              fontSize: '0.9rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            <LogOut size={16} />
            Sign Out
          </button>

          <button
            type="button"
            onClick={onStayLoggedIn}
            className="premium-btn"
            style={{
              flex: 1.3,
              padding: '0.75rem 1rem',
              fontSize: '0.9rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            Stay Logged In
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
