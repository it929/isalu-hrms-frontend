"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '../../../../contexts/SessionContext';
import { motion } from 'framer-motion';
import axios from 'axios';
import { KeyRound, User, UserCheck, ShieldAlert, Eye, EyeOff } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/nextjs';

export default function EditAccount() {
  const { user, activeRole, login } = useSession();
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setUsername(user.username || '');
    }
  }, [user]);

  if (!user) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--secondary)' }}>
        Loading session details...
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Password confirmation does not match.');
      setLoading(false);
      return;
    }

    try {
      const res = await axios.post(
        `${API_BASE}/update-account`,
        {
          userName: username,
          password,
          password_confirmation: confirmPassword,
        },
        {
          headers: {
            'X-User-Id': user.id,
          },
        }
      );

      if (res.data.status === 'success') {
        setSuccess(res.data.message || 'Your account was updated successfully!');
        // Update session user data
        login(res.data.user, activeRole);
        
        // Reset fields
        setPassword('');
        setConfirmPassword('');

        // Redirect back to dashboard after a short delay
        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);
      } else {
        setError(res.data.message || 'Failed to update account.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update account. Please check validations.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.4 }}
      style={{ maxWidth: '800px', margin: '0 auto', padding: '1.5rem' }}
    >
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.85rem', fontWeight: '800', color: 'var(--foreground)', margin: '0 0 0.5rem 0' }}>
          Edit User Account
        </h1>
        <p style={{ color: 'var(--secondary)', margin: 0, fontSize: '0.95rem' }}>
          Update your login details, username, and change your password.
        </p>
      </div>

      {user.must_change_password && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: '10px',
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          color: '#ef4444'
        }}>
          <ShieldAlert size={20} />
          <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>
            Security Notice: You must change your default password before proceeding.
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="premium-card" style={{ padding: '2.5rem', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {error && (
          <div style={{ color: '#ef4444', backgroundColor: '#fee2e2', padding: '1rem', borderRadius: '8px', fontSize: '0.9rem', border: '1px solid #fca5a5', fontWeight: '500' }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{ color: '#10b981', backgroundColor: '#d1fae5', padding: '1rem', borderRadius: '8px', fontSize: '0.9rem', border: '1px solid #6ee7b7', fontWeight: '500' }}>
            {success}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
          {/* Full name (Readonly) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--foreground)' }}>Full Name</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--surface-hover)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>
              <User size={18} />
              <span style={{ fontSize: '0.95rem', fontWeight: '500' }}>{user.name}</span>
            </div>
          </div>

          {/* User Role (Readonly) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--foreground)' }}>User Role</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--surface-hover)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>
              <UserCheck size={18} />
              <span style={{ fontSize: '0.95rem', fontWeight: '500' }}>{activeRole?.name || 'Staff'}</span>
            </div>
          </div>

          {/* Username (Editable) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label htmlFor="userName" style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--foreground)' }}>User Name *</label>
            <input 
              id="userName"
              type="text" 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              required 
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                fontSize: '0.95rem',
                color: 'var(--foreground)',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
            />
          </div>
        </div>

        <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '0' }} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
          {/* New Password */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label htmlFor="password" style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--foreground)' }}>New Password *</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input 
                id="password"
                type={showPassword ? "text" : "password"} 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
                placeholder="Min. 5 characters"
                style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '0.75rem 2.5rem 0.75rem 1rem',
                  fontSize: '0.95rem',
                  color: 'var(--foreground)',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  width: '100%'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  background: 'none',
                  border: 'none',
                  color: 'var(--secondary, #64748b)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0
                }}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label htmlFor="confirmPassword" style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--foreground)' }}>Confirm Password *</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input 
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"} 
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)} 
                required 
                placeholder="Re-type new password"
                style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '0.75rem 2.5rem 0.75rem 1rem',
                  fontSize: '0.95rem',
                  color: 'var(--foreground)',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  width: '100%'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  background: 'none',
                  border: 'none',
                  color: 'var(--secondary, #64748b)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0
                }}
                title={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button 
            type="submit" 
            className="premium-btn" 
            disabled={loading}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              padding: '0.75rem 2rem',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            <KeyRound size={16} />
            {loading ? 'Saving Changes...' : 'Save Profile'}
          </button>
        </div>
      </form>
    </motion.div>
  );
}
