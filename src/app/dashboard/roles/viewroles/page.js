"use client";

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  ShieldAlert,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Edit2,
  Shield,
  Search,
} from 'lucide-react';
import styles from '../create/page.module.css';

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

export default function ViewUserRolesPage() {
  // Loading & Toast states
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [updating, setUpdating] = useState(false);

  // Roles list & filter states
  const [roles, setRoles] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Edit Modal states
  const [editRole, setEditRole] = useState(null); // { roleID, rolename }
  const [editRoleName, setEditRoleName] = useState('');
  const [editFormError, setEditFormError] = useState('');

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  }, []);

  const clearRolesCache = useCallback(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('hrms_view_roles_cache');
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('hrms_create_role_roles_cache_')) {
          sessionStorage.removeItem(key);
        }
      });
    }
  }, []);

  // Fetch all roles (unpaginated/large page size to display all)
  const fetchRoles = useCallback(async (silent = false) => {
    const cacheKey = 'hrms_view_roles_cache';
    let hasCache = false;

    if (!silent) {
      if (typeof window !== 'undefined') {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          setRoles(JSON.parse(cached));
          hasCache = true;
        }
      }
      if (!hasCache) setLoading(true);
    }

    const headers = buildHeaders();
    try {
      const response = await axios.get(`${API_BASE}/roles`, {
        params: { perPage: 100 },
        headers
      });
      if (response.data.status === 'success') {
        const freshData = response.data.data || [];
        setRoles(freshData);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(cacheKey, JSON.stringify(freshData));
        }
      } else {
        showToast(response.data.message || 'Failed to fetch roles.', 'error');
      }
    } catch (err) {
      console.error('Error fetching roles:', err);
      showToast(err.response?.data?.message || 'Error connecting to the server.', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let hasCache = false;
    if (typeof window !== 'undefined') {
      hasCache = !!sessionStorage.getItem('hrms_view_roles_cache');
    }
    if (hasCache) {
      const cached = sessionStorage.getItem('hrms_view_roles_cache');
      if (cached) {
        setRoles(JSON.parse(cached));
      }
    }
    fetchRoles(hasCache);
  }, [fetchRoles]);

  // Open Edit Modal
  const openEditModal = (role) => {
    setEditRole(role);
    setEditRoleName(role.rolename);
    setEditFormError('');
  };

  // Close Edit Modal
  const closeEditModal = () => {
    setEditRole(null);
    setEditRoleName('');
    setEditFormError('');
  };

  // Handle Edit Submit
  const handleEditRoleSubmit = async (e) => {
    e.preventDefault();
    setEditFormError('');

    if (!editRoleName.trim()) {
      setEditFormError('Role name is required.');
      return;
    }

    const regex = /^[a-zA-Z0-9,.!?\-)\( ]*$/;
    if (!regex.test(editRoleName)) {
      setEditFormError('Role name contains invalid characters.');
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
        clearRolesCache();
        fetchRoles(true); // silent refresh
      } else {
        setEditFormError(response.data.message || 'Failed to update role.');
      }
    } catch (err) {
      console.error('Error updating role:', err);
      setEditFormError(err.response?.data?.message || 'An error occurred while updating the role.');
    } finally {
      setUpdating(false);
    }
  };

  // Filter roles locally based on search query
  const filteredRoles = roles.filter(role =>
    role.rolename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={styles.container}>
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className={`${styles.toast} ${toast.type === 'success' ? styles.toastSuccess : styles.toastError}`}
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            {toast.type === 'success' ? <CheckCircle2 size={18} /> : <ShieldAlert size={18} />}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div className={styles.header}>
          <h1>Users Roles</h1>
          <p>View and manage all system roles defined in the database</p>
        </div>
      </div>

      {/* Roles List Table Panel */}
      <div className={styles.panel}>
        <div className={styles.panelHeading}>
          <h3 className={styles.panelTitle}>
            <Shield size={18} /> All Roles Listing
          </h3>
          
          {/* Client-side Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#111827', border: '1px solid #374151', borderRadius: '8px', padding: '0.4rem 0.8rem' }}>
            <Search size={16} style={{ color: '#9ca3af' }} />
            <input
              type="text"
              placeholder="Search roles..."
              style={{ background: 'none', border: 'none', color: '#f3f4f6', outline: 'none', fontSize: '0.85rem', width: '220px' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className={styles.panelBody}>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>S/N</th>
                  <th>Role Name</th>
                  <th>Date Created</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && !roles.length ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                      <Loader2 size={32} className={styles.spinner} style={{ margin: '0 auto 1rem' }} />
                      <span style={{ color: 'var(--text-secondary)' }}>Loading system roles…</span>
                    </td>
                  </tr>
                ) : !filteredRoles.length ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
                      No roles found.
                    </td>
                  </tr>
                ) : (
                  filteredRoles.map((item, idx) => {
                    return (
                      <tr key={item.roleID}>
                        <td>{idx + 1}</td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {item.rolename.toUpperCase()}
                        </td>
                        <td>
                          {item.created_at ? new Date(item.created_at).toLocaleDateString() : '—'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className={styles.actionBtn}
                            title="Edit Role"
                            onClick={() => openEditModal(item)}
                          >
                            <Edit2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit Role Modal */}
      <AnimatePresence>
        {editRole && (
          <div className={styles.modalBackdrop}>
            <motion.div
              className={styles.modal}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <div className={styles.panelTitle}>
                <Edit2 size={18} /> Edit Role Name
              </div>
              <form onSubmit={handleEditRoleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
                <div className={styles.formGroup}>
                  <label htmlFor="editRoleName">Role Name</label>
                  <input
                    id="editRoleName"
                    type="text"
                    className={styles.formControl}
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
                <div className={styles.formActions}>
                  <button
                    type="button"
                    className={styles.btnCancel}
                    onClick={closeEditModal}
                    disabled={updating}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={styles.btnSubmit}
                    disabled={updating}
                  >
                    {updating && <Loader2 size={16} className={styles.spinner} />}
                    {updating ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
