"use client";

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import Link from 'next/link';
import {
  Plus,
  Edit2,
  Shield,
  Layers,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/nextjs';

function getUserId() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('hrms_user');
    if (raw) return JSON.parse(raw)?.id ?? null;
  } catch { /* ignore */ }
  return null;
}

function buildHeaders() {
  const uid = getUserId();
  return uid ? { 'X-User-Id': uid } : {};
}

export default function RolesAndModules() {
  const [activeTab, setActiveTab] = useState('roles');
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState([]);
  const [toast, setToast] = useState(null);

  // Edit Modal states
  const [editRole, setEditRole] = useState(null); // { roleID, rolename }
  const [editRoleName, setEditRoleName] = useState('');
  const [editFormError, setEditFormError] = useState('');
  const [updating, setUpdating] = useState(false);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  }, []);

  const fetchRoles = useCallback(async (silent = false) => {
    const cacheKey = 'hrms_roles_main_cache';
    let hasCache = false;
    if (!silent && typeof window !== 'undefined') {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setRoles(JSON.parse(cached));
        hasCache = true;
      }
    }
    if (!hasCache && !silent) setLoading(true);

    const headers = buildHeaders();
    try {
      const response = await axios.get(`${API_BASE}/roles`, {
        params: { perPage: 100 }, // Fetch all for overview
        headers
      });
      if (response.data.status === 'success') {
        const freshData = response.data.data || [];
        setRoles(freshData);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(cacheKey, JSON.stringify(freshData));
        }
      }
    } catch (err) {
      console.error('Error fetching roles:', err);
      showToast('Failed to fetch system roles.', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let hasCache = false;
    if (typeof window !== 'undefined') {
      hasCache = !!sessionStorage.getItem('hrms_roles_main_cache');
    }
    if (hasCache) {
      const cached = sessionStorage.getItem('hrms_roles_main_cache');
      if (cached) {
        setRoles(JSON.parse(cached));
      }
    }
    fetchRoles(hasCache);
  }, [fetchRoles]);

  const openEditModal = (role) => {
    setEditRole(role);
    setEditRoleName(role.rolename);
    setEditFormError('');
  };

  const closeEditModal = () => {
    setEditRole(null);
    setEditRoleName('');
    setEditFormError('');
  };

  const handleEditRoleSubmit = async (e) => {
    e.preventDefault();
    setEditFormError('');

    if (!editRoleName.trim()) {
      setEditFormError('Role name is required.');
      return;
    }

    setUpdating(true);
    const headers = buildHeaders();
    try {
      const response = await axios.post(`${API_BASE}/roles/update/${editRole.roleID}`, {
        roleName: editRoleName.trim()
      }, { headers });

      if (response.data.status === 'success') {
        showToast(response.data.message || 'Role Successfully Updated', 'success');
        closeEditModal();
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('hrms_roles_main_cache');
        }
        fetchRoles(true);
      } else {
        setEditFormError(response.data.message || 'Failed to update role.');
      }
    } catch (err) {
      console.error('Error updating role:', err);
      setEditFormError(err.response?.data?.message || 'An error occurred.');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}
    >
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            style={{
              position: 'fixed',
              bottom: '2rem',
              right: '2rem',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '1rem 1.25rem',
              borderRadius: '8px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
              fontWeight: '500',
              fontSize: '0.9rem',
              background: toast.type === 'success' ? '#064e3b' : '#7f1d1d',
              color: toast.type === 'success' ? '#34d399' : '#f87171',
              border: toast.type === 'success' ? '1px solid #059669' : '1px solid #b91c1c',
            }}
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            {toast.type === 'success' ? <CheckCircle2 size={18} /> : <ShieldAlert size={18} />}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>Roles & Modules</h1>
          <p style={{ color: 'var(--secondary)' }}>Manage system roles and feature module access.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
        <button 
          onClick={() => setActiveTab('roles')}
          style={{ background: 'none', border: 'none', color: activeTab === 'roles' ? 'var(--primary)' : 'var(--secondary)', fontWeight: '600', padding: '0.5rem 1rem', cursor: 'pointer', borderBottom: activeTab === 'roles' ? '2px solid var(--primary)' : '2px solid transparent', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Shield size={18} /> Roles
        </button>
        <button 
          onClick={() => setActiveTab('modules')}
          style={{ background: 'none', border: 'none', color: activeTab === 'modules' ? 'var(--primary)' : 'var(--secondary)', fontWeight: '600', padding: '0.5rem 1rem', cursor: 'pointer', borderBottom: activeTab === 'modules' ? '2px solid var(--primary)' : '2px solid transparent', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Layers size={18} /> Modules
        </button>
      </div>

      <div className="premium-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1.25rem' }}>{activeTab === 'roles' ? 'System Roles' : 'System Modules'}</h3>
          {activeTab === 'roles' ? (
            <Link href="/dashboard/roles/create" className="premium-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.8rem', fontSize: '0.875rem', textDecoration: 'none' }}>
              <Plus size={16} /> Add Role
            </Link>
          ) : (
            <button className="premium-btn" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.8rem', fontSize: '0.875rem' }}>
              <Plus size={16} /> Add Module
            </button>
          )}
        </div>

        {activeTab === 'roles' ? (
          loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
              <Loader2 size={32} className="spinner" style={{ animation: 'rotate 1s linear infinite' }} />
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
              {roles.map((role) => (
                <div key={role.roleID} style={{ padding: '1.5rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <h4 style={{ fontWeight: '600', fontSize: '1.1rem' }}>{role.rolename.toUpperCase()}</h4>
                    <button 
                      style={{ background: 'none', border: 'none', color: 'var(--secondary)', cursor: 'pointer' }}
                      onClick={() => openEditModal(role)}
                    >
                      <Edit2 size={16} />
                    </button>
                  </div>
                  <p style={{ color: 'var(--secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                    Created: {role.created_at ? new Date(role.created_at).toLocaleDateString() : '—'}
                  </p>
                </div>
              ))}
            </div>
          )
        ) : (
          <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
            {['HR Module', 'Payroll Module', 'Procurement', 'Funds Management'].map((mod, i) => (
              <div key={i} style={{ padding: '1.5rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h4 style={{ fontWeight: '600', fontSize: '1.1rem' }}>{mod}</h4>
                  <button style={{ background: 'none', border: 'none', color: 'var(--secondary)', cursor: 'pointer' }}><Edit2 size={16} /></button>
                </div>
                <p style={{ color: 'var(--secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>Core application module.</p>
                <div style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--primary)' }}>12 Sub-modules</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Role Modal */}
      <AnimatePresence>
        {editRole && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1.5rem'
          }}>
            <motion.div
              style={{
                background: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '12px',
                padding: '1.5rem',
                maxWidth: '480px',
                width: '100%',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#f3f4f6', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Edit2 size={18} /> Edit Role Name
              </div>
              <form onSubmit={handleEditRoleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label htmlFor="editRoleName" style={{ fontWeight: '600', color: '#9ca3af', fontSize: '0.9rem' }}>Role Name</label>
                  <input
                    id="editRoleName"
                    type="text"
                    style={{
                      background: '#111827',
                      color: '#f3f4f6',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      padding: '0.65rem 0.85rem',
                      fontSize: '0.95rem',
                      width: '100%',
                      outline: 'none'
                    }}
                    value={editRoleName}
                    onChange={(e) => setEditRoleName(e.target.value)}
                    disabled={updating}
                    required
                  />
                  {editFormError && (
                    <p style={{ color: '#f87171', fontSize: '0.85rem', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <AlertCircle size={14} /> {editFormError}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    style={{
                      background: '#374151',
                      color: '#d1d5db',
                      border: '1px solid #4b5563',
                      padding: '0.5rem 1rem',
                      borderRadius: '6px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                    onClick={closeEditModal}
                    disabled={updating}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      background: '#10b981',
                      color: '#ffffff',
                      border: 'none',
                      padding: '0.5rem 1rem',
                      borderRadius: '6px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                    disabled={updating}
                  >
                    {updating && <Loader2 size={16} className="spinner" style={{ animation: 'rotate 1s linear infinite' }} />}
                    {updating ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
