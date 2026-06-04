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
  ChevronLeft,
  ChevronRight,
  Shield,
  Plus,
} from 'lucide-react';
import styles from './page.module.css';

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

function getPaginationRange(currentPage, lastPage) {
  const delta = 1;
  const range = [];
  const rangeWithDots = [];
  let l;

  for (let i = 1; i <= lastPage; i++) {
    if (i === 1 || i === lastPage || (i >= currentPage - delta && i <= currentPage + delta)) {
      range.push(i);
    }
  }

  for (let i of range) {
    if (l) {
      if (i - l === 2) {
        rangeWithDots.push(l + 1);
      } else if (i - l > 2) {
        rangeWithDots.push('...');
      }
    }
    rangeWithDots.push(i);
    l = i;
  }

  return rangeWithDots;
}

export default function CreateUserRolePage() {
  // Loading & Toast states
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [toast, setToast] = useState(null);

  // Roles list & pagination states
  const [roles, setRoles] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const perPage = 10;

  // Form states
  const [roleName, setRoleName] = useState('');
  const [formError, setFormError] = useState('');

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
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('hrms_create_role_roles_cache_')) {
          sessionStorage.removeItem(key);
        }
      });
    }
  }, []);

  // Fetch roles list from API
  const fetchRoles = useCallback(async (pageNum = 1, silent = false) => {
    const cacheKey = `hrms_create_role_roles_cache_${pageNum}`;
    let hasCache = false;
    if (!silent) {
      if (typeof window !== 'undefined') {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const resData = JSON.parse(cached);
          setRoles(resData.data || []);
          setTotal(resData.total || 0);
          setPage(resData.page || 1);
          setLastPage(resData.lastPage || 1);
          hasCache = true;
        }
      }
      if (!hasCache) setLoading(true);
    }

    const headers = buildHeaders();
    try {
      const response = await axios.get(`${API_BASE}/roles`, {
        params: { page: pageNum, perPage },
        headers
      });
      if (response.data.status === 'success') {
        setRoles(response.data.data || []);
        setTotal(response.data.total || 0);
        setPage(response.data.page || 1);
        setLastPage(response.data.lastPage || 1);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(cacheKey, JSON.stringify(response.data));
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
      hasCache = !!sessionStorage.getItem(`hrms_create_role_roles_cache_1`);
    }
    if (hasCache) {
      const cached = sessionStorage.getItem(`hrms_create_role_roles_cache_1`);
      if (cached) {
        const resData = JSON.parse(cached);
        setRoles(resData.data || []);
        setTotal(resData.total || 0);
        setPage(resData.page || 1);
        setLastPage(resData.lastPage || 1);
      }
    }
    fetchRoles(1, hasCache);
  }, [fetchRoles]);

  // Validate roleName using the exact regex constraint: /^[a-zA-Z0-9,.!?\-)\( ]*$/
  const validateRoleName = (name) => {
    const regex = /^[a-zA-Z0-9,.!?\-)\( ]*$/;
    if (!name.trim()) {
      return 'Role name is required.';
    }
    if (!regex.test(name)) {
      return 'Role name contains invalid characters.';
    }
    if (name.length > 1000) {
      return 'Role name must not exceed 1000 characters.';
    }
    return '';
  };

  // Handle Form submit (Add Role)
  const handleAddRoleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const error = validateRoleName(roleName);
    if (error) {
      setFormError(error);
      return;
    }

    setSaving(true);
    const headers = buildHeaders();
    try {
      const response = await axios.post(`${API_BASE}/roles`, {
        roleName: roleName.trim()
      }, { headers });

      if (response.data.status === 'success') {
        showToast(response.data.message || 'New Role Created Successfully', 'success');
        setRoleName('');
        clearRolesCache();
        fetchRoles(1, true); // reload first page silently
      } else {
        setFormError(response.data.message || 'Failed to create role.');
      }
    } catch (err) {
      console.error('Error creating role:', err);
      const validationErrors = err.response?.data?.errors;
      if (validationErrors && validationErrors.roleName) {
        setFormError(validationErrors.roleName[0]);
      } else {
        setFormError(err.response?.data?.message || 'An error occurred while creating the role.');
      }
    } finally {
      setSaving(false);
    }
  };

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

    const error = validateRoleName(editRoleName);
    if (error) {
      setEditFormError(error);
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
        fetchRoles(page, true); // reload current page silently
      } else {
        setEditFormError(response.data.message || 'Failed to update role.');
      }
    } catch (err) {
      console.error('Error updating role:', err);
      const validationErrors = err.response?.data?.errors;
      if (validationErrors && validationErrors.roleName) {
        setEditFormError(validationErrors.roleName[0]);
      } else {
        setEditFormError(err.response?.data?.message || 'An error occurred while updating the role.');
      }
    } finally {
      setUpdating(false);
    }
  };

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
            {toast.type === 'success'
              ? <CheckCircle2 size={18} />
              : <ShieldAlert size={18} />
            }
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={styles.header}>
        <h1>Add New Role</h1>
        <p>Configure user roles and permissions in the system</p>
      </div>

      {/* Main Grid */}
      <div className={styles.dashboardGrid}>
        
        {/* Form Panel */}
        <div className={styles.panel}>
          <div className={styles.panelHeading}>
            <h3 className={styles.panelTitle}>
              <Plus size={18} /> Create System Role
            </h3>
          </div>
          <div className={styles.panelBody}>
            <form onSubmit={handleAddRoleSubmit} className={styles.formHorizontal}>
              <div className={styles.formGroup}>
                <label htmlFor="roleName">Role Name</label>
                <input
                  id="roleName"
                  type="text"
                  className={styles.formControl}
                  placeholder="e.g. Internal Auditor"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  disabled={saving}
                  required
                />
                {formError && (
                  <p style={{ color: '#f87171', fontSize: '0.85rem', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <AlertCircle size={14} /> {formError}
                  </p>
                )}
              </div>
              <div className={styles.formActions}>
                <button
                  type="submit"
                  className={styles.btnSubmit}
                  disabled={saving}
                >
                  {saving && <Loader2 size={16} className={styles.spinner} />}
                  {saving ? 'Saving…' : 'Add Role'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Roles Table Panel */}
        <div className={styles.panel}>
          <div className={styles.panelHeading}>
            <h3 className={styles.panelTitle}>
              <Shield size={18} /> All Roles
            </h3>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Total: {total} roles
            </span>
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
                  ) : !roles.length ? (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
                        No roles configured in the database.
                      </td>
                    </tr>
                  ) : (
                    roles.map((item, idx) => {
                      const serialNumber = ((page - 1) * perPage) + idx + 1;
                      return (
                        <tr key={item.roleID}>
                          <td>{serialNumber}</td>
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
                              title="Edit Role Name"
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

            {/* Pagination Controls */}
            {lastPage > 1 && (
              <div className={styles.pagination}>
                <span className={styles.paginationInfo}>
                  Showing {((page - 1) * perPage) + 1}–{Math.min(page * perPage, total)} of {total} entries
                </span>
                <div className={styles.paginationControls}>
                  <button
                    className={styles.pageBtn}
                    disabled={page <= 1 || loading}
                    onClick={() => fetchRoles(page - 1)}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  {getPaginationRange(page, lastPage).map((pg, index) => {
                    if (pg === '...') {
                      return (
                        <span key={`dots-${index}`} style={{ padding: '0 0.5rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', fontSize: '0.9rem' }}>
                          ...
                        </span>
                      );
                    }
                    return (
                      <button
                        key={pg}
                        className={`${styles.pageBtn} ${pg === page ? styles.pageBtnActive : ''}`}
                        disabled={loading}
                        onClick={() => fetchRoles(pg)}
                      >
                        {pg}
                      </button>
                    );
                  })}
                  <button
                    className={styles.pageBtn}
                    disabled={page >= lastPage || loading}
                    onClick={() => fetchRoles(page + 1)}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
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
